function xmlTvParser(xmlDocument) {
	if (typeof jQuery == 'undefined')
		throw new Error('jQuery is required!');
	if (typeof moment == 'undefined')
		throw new Error('moment.js is required!');

	var NEAREST_PROGRAM_HOURS = 5;	// количество часов для получение программы на ближайшее время
	var BEGIN_DAY_HOUR = 5;			// час с которого начинается телевизионный день
	var DATETIME_FORMAT = 'YYYYMMDDHHmmss';
	var channels = [];
	var programmes = [];
	var weekStartTime;
	var weekEndTime;	

	// Парсинг XML-файла формата XMLTV
	function parseXmlTv(curXmlDocument) {
		var $xmlDoc = $(curXmlDocument);
		parseChannels($xmlDoc);
		parseProgramms($xmlDoc);
	}

	// Получить список каналов с расписанием передач
	function getChannelsSchedules() {
		return channels;
	}

	// Получить список каналов с расписанием передач на ближайшее время
	function getNearestPrograms() {
		var nowTime = getCurrentProgramDate();
		var nearestTime = nowTime.clone().add(NEAREST_PROGRAM_HOURS, 'hours');

		var nearestPrograms = $.grep(programmes, function(e) {
			return e.endTime > nowTime && e.beginTime < nearestTime;
		});

		var nearestProgramChannels = [];
		$(channels).each(function(index, channel) {
			var currentScheduleDay = {
				programmes: []
			};
			currentScheduleDay.programmes = $.grep(nearestPrograms, function(e) { return e.channelId == channel.id; })
			var currentChannel = {
				id: channel.id,
				name: channel.name,
				iconSrc: channel.iconSrc,
				scheduleDays: []
			};
			currentChannel.scheduleDays.push(currentScheduleDay);
			nearestProgramChannels.push(currentChannel);
		});

		return nearestProgramChannels;
	}

	// Получить список программ, показываемых сейчас на телеканалах
	function getCurrentPrograms() {
    	var currentPrograms = [];
		var nowTime = getCurrentProgramDate();
		var programDate = getScheduleDate(nowTime)

		$(channels).each(function(index, channel) {			
			var scheduleDay;
			var result = $.grep(channel.scheduleDays, function(e) { return programDate.isSame(e.scheduleDate); });
			if (result.length == 1)
				scheduleDay = result[0];
			else
				return;

			var programNow;
			var programsNow = $.grep(scheduleDay.programmes, function(e) { 
				return nowTime.isBetween(e.beginTime, e.endTime); 
			});
			if (programsNow.length == 1)
				programNow = programsNow[0];
			else
				return;

			var programDuration = programNow.endTime.diff(programNow.beginTime, 'minutes');
			var elapsedDuration = nowTime.diff(programNow.beginTime, 'minutes');
			var elapsedPercents = Math.round(elapsedDuration * 100 / programDuration);

			currentPrograms.push({
				channelName: channel.name,
				programTitle: programNow.title,
				iconSrc: programNow.iconSrc,
				time: programNow.beginTime.format("HH:mm"),
				elapsed: elapsedPercents
			});
		});

		return currentPrograms;
    }

	// Парсинг каналов
	function parseChannels($xmlDoc) {
		channels = [];
		$xmlDoc.find('channel').each(function() {
			var $this = $(this);
			var $displayName = $this.find('display-name');		
			var $icon = $this.find('icon');
			var lang = $displayName.attr('lang');

			channels.push({
			 	id: $this.attr('id'),
			 	name: $displayName.text(),
			 	iconSrc: $icon.attr('src'),
			 	scheduleDays: []
			});					
		});
	}

	// Парсинг программ
	function parseProgramms($xmlDoc) {
		programmes = [];
		weekStartTime = undefined;
		weekEndTime = undefined;		
		$xmlDoc.find('programme').each(function() {
			var $this = $(this);
			var $title = $this.find('title');
			var $desc = $this.find('desc');
			var $category = $this.find('category');
			var $icon = $this.find('icon');
			var $rating = $this.find('rating');

			var channelId = $this.attr('channel');
			var iconSrc = $icon.attr('src');
			var programTitle = $title.text();
			var programDesc = $desc.text();
			var programCategory = $category.text();
			var programRating= $rating.text();
			var beginTime = moment($this.attr('start'), DATETIME_FORMAT);
			var endTime = moment($this.attr('stop'), DATETIME_FORMAT);

			if (weekStartTime === undefined || beginTime.isBefore(weekStartTime))
				weekStartTime = beginTime;
			if (weekEndTime === undefined || endTime.isAfter(weekEndTime))
				weekEndTime = endTime;

			var currentProgram = {
				channelId: channelId,
				programId: channelId + '_' + beginTime.format(DATETIME_FORMAT),
				category: programCategory,
				title: programTitle,
				desc: programDesc,
				rating: programRating,
				iconSrc: iconSrc,
				beginTime: beginTime,
				endTime: endTime
			};
			programmes.push(currentProgram);
			var programDate = getScheduleDate(currentProgram.beginTime);

			var curChannel = getChannelById(channelId);
			if (curChannel !== null)
			{
				var channelScheduleDay = getOrCreateChannelScheduleDay(curChannel, programDate);
				if (curChannel !== null)
					channelScheduleDay.programmes.push(currentProgram);
			}
		});
	}

	// Получить день, в программу передач которого, входит передача в заданное время
	function getScheduleDate(beginTime) {
		var programDate = beginTime.clone().startOf('day');	// день в который идет передача
		if (beginTime.get('hour') < BEGIN_DAY_HOUR)			// передачи до 5 утра попадают в предыдущий день
			programDate.subtract(1, 'days');
		return programDate;
	}

	// Получить дату, соответствующую текущей дате телепрограммы
	function getCurrentProgramDate() {
		currentProgramDate = moment();
		while (currentProgramDate.isAfter(weekEndTime))
			currentProgramDate.subtract(7, 'days');
		while (currentProgramDate.isBefore(weekStartTime))
			currentProgramDate.add(7, 'days');
		return currentProgramDate.clone();
	}

	// Получить индекс текущего дня телепрограммы
	function getCurrentScheduleDayIndex() {
		var scheduleDate = getScheduleDate(getCurrentProgramDate());
		var scheduleDayIndex = scheduleDate.day();
		if (scheduleDayIndex === 0)
			scheduleDayIndex = 6;
		else
			scheduleDayIndex--;
		return scheduleDayIndex;
	}

	// Получить или создать расписание дня для телеканала
	function getOrCreateChannelScheduleDay(channel, programDate) {
		var findedDay = null;
		var result = $.grep(channel.scheduleDays, function(e){ return programDate.isSame(e.scheduleDate); });
		if (result.length == 0) {
			findedDay = {
				scheduleDate: programDate,
				programmes: []
			};
			channel.scheduleDays.push(findedDay);
		}
		else if (result.length == 1) {
			findedDay = result[0];
		}
		return findedDay;
	}

	// Получить телеканал по идентификатору
	function getChannelById(channelId) {
		var currentChannel = null;
		var result = $.grep(channels, function(e) { return e.id == channelId; });
		if (result.length == 1) {
			currentChannel = result[0];
		}
		return currentChannel;
	}

	// Получить программу по идентификатору
	function getProgramById(programId) {
		var currentProgram = null;
		var result = $.grep(programmes, function(e) { return e.programId == programId; })
		if (result.length == 1) {
			currentProgram = result[0];
		}
		return currentProgram;
	}

	parseXmlTv(xmlDocument);
	return {
		getChannelsSchedules: getChannelsSchedules,
		getCurrentPrograms: getCurrentPrograms,
		getNearestPrograms: getNearestPrograms,
		getChannelById: getChannelById,
		getProgramById: getProgramById,
		getCurrentScheduleDayIndex: getCurrentScheduleDayIndex
	};
}