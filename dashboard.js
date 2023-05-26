$(document).ready(function() {
    let client;
    let transforms = {};
    let temperature_units = Cookies.get('temperature_units') || 'C';

    transforms['transform_hours'] = function(value) {
	let d = new Date(value*1000);

	return d.getHours() + ':' + d.getMinutes();
    };

    transforms['transform_temperature'] = function(value) {
	if(temperature_units === 'F')
	    return String((Number(value)*9/5+32).toFixed(1)) + '°F';
	if(temperature_units === 'C')
	    return Number(value).toFixed(1) + '°C';
	if(temperature_units === 'K')
	    return (Number(value) + 273.15).toFixed(1) + '°K';

	return '??.?°' + temperature_units;
    };

    transforms['transform_humidity'] = function(value) {
	return Number(value).toFixed(0);
    };

    transforms['transform_pressure'] = function(value) {
	return Number(value).toFixed(0);
    };

    transforms['transform_pms'] = function(value, ddc_type, ddc) {
	return ddc["pm1"] + '/' + ddc["pm25"] + '/' + ddc["pm10"];
    };

    transforms['transform_lock'] = function(value, ddc_type, ddc) {
	if(ddc['action'] === 'unlocked' || ddc['action'] === 'already unlocked')
	    return '<i class="fas fa-lock-open" style="color: red;"></i>';
	else
	    return '<i class="fas fa-lock" style="color: green;"></i>';
    };

    transforms['transform_access_list'] = function(value, ddc_type, ddc) {
	let results = '';

	console.log('transform access list');

	ddc.reverse().forEach(function(item) {
	    datetime = item['timestamp'];

	    results += "<li class='list-group-item'>" + item["door"] + " " + item["person"] + " " + item["action"] + "<br><time class='embedded-timeago' datetime='" + datetime + "'></time></li>";
	});

	return results;
    };

    transforms['transform_filesystems'] = function(value, ddc_type, ddc) {
	let results = '';

	ddc['filesystems'].forEach(function(item, index) {
            results += '<tr><td></td><td>' + item['mount_point'] + '</td><td>' + (100 - Number(item['used_percentage'])) + '% free</td></tr>';
	});

	return results;
    };


    // from https://stackoverflow.com/questions/36098913/convert-seconds-to-days-hours-minutes-and-seconds
    function secondsToDhms(seconds) {
	seconds = Number(seconds);
	var d = Math.floor(seconds / (3600*24));
	var h = Math.floor(seconds % (3600*24) / 3600);
	var m = Math.floor(seconds % 3600 / 60);
	var s = Math.floor(seconds % 60);

	var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
	var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
	var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
	var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
	return dDisplay + hDisplay + mDisplay + sDisplay;
    }

    transforms['transform_seconds_to_dhms'] = function(value, ddc_type, ddc) {
	return secondsToDhms(value);
    };


    function thousandsSuffix(value) {
	if(value == 0)
	    return '0';

	const sizes = [ '', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y' ];
	const i = Math.floor(Math.log(value) / Math.log(1024));
	return parseFloat((value / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
    };

    transforms['transform_thousands'] = function(value, ddc_type, ddc) {
	return thousandsSuffix(value);
    }

    initImageHTML('.load-image-html'); 
    initServerHTML('.load-server-html'); 
    initWeatherHTML('.load-weather-html');
    initAQIHTML('.load-aqi-html'); 
//    initAlertHTML('.load-alert-html'); 
    init3DPrinterHTML('.load-3dprinter-html');
    initDeviceHTML('.load-device-html');
    initLEDHTML('.load-led-html');
    initRoomHTML('.load-room-html');

    // https://github.com/rmm5t/jquery-timeago
    $('.timeago').timeago();

    // enable lightbox
    $(document).on('click', '[data-toggle="lightbox"]', function(event) {
        event.preventDefault();
        $(this).ekkoLightbox();
    });

    // enable temperature unit button
    $('#temperature-units').val(temperature_units);
    $('#temperature-units').change(function() {
	$("select#temperature-units option:selected").each(function() {
	    temperature_units = $(this).text();
	    Cookies.set('temperature_units', temperature_units, { expires: 365 });

	    $('[data-transform="transform_temperature"]').each(function() {
		let json = $(this).attr('data-value');
		console.error(json);
		if(json) {
		    let temperature = JSON.parse($(this).attr('data-value'));
		    $(this).html(transforms['transform_temperature'](temperature));
		}
	    });
	});
    });

    // MQTT/Homebus setup - should be wrapped in a Homebus class
    client = new Paho.Client(credentials.MQTT_SERVER, credentials.MQTT_PORT, credentials.MQTT_UUID + new Date().getTime());
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    let options = {
	useSSL: true,
	userName: credentials.MQTT_USERNAME,
	password: credentials.MQTT_PASSWORD,
	onSuccess:onConnect,
	onFailure:doFail,
	reconnect: true
    };

    client.connect(options); 

// we loaded the credentials in separate JS
// this is still not at all secure but it allows us to decouple management of this page and its content
// from management of the credentials, and lets us not check them into Github
// (despite the fact that they're flapping in the window here on the web)
// they should be for an account with read-only access only to the topic used for the hydroponics

function onConnect() {
    client.subscribe('/projectors');

    // laser access 
    client.subscribe('/homebus/device/8a6f30c2-7adc-44aa-bf0b-aeea197a02c0');

    // modern devices - subscribe using the DDC
    [ 'org.homebus.experimental.image',
      'org.homebus.experimental.server-status',
      'org.homebus.experimental.led-status',
      'org.homebus.experimental.led-update',
      'org.homebus.experimental.weather',
      'org.homebus.experimental.alert',
      'org.homebus.experimental.aqi-pm25',
      'org.homebus.experimental.aqi-o3',
      'org.homebus.experimental.contact-sensor',
      'org.homebus.experimental.occupancy-sensor',
      'org.homebus.experimental.voc-sensor',
      'org.homebus.experimental.co2-sensor',
      'org.homebus.experimental.air-sensor',
      'org.homebus.experimental.air-quality-sensor',
      'org.homebus.experimental.light-sensor',
      'org.homebus.experimental.uv-light-sensor',
      'org.homebus.experimental.soil-sensor',
      'org.homebus.experimental.temperature-sensor',
      'org.homebus.experimental.system', 
      'org.homebus.experimental.diagnostic', 
      'org.homebus.experimental.3dprinter',
      'org.homebus.experimental.printer', 
      'org.homebus.experimental.switch',
      'org.homebus.experimental.network-bandwidth',
      'org.homebus.experimental.network-active-hosts',
      'org.pdxhackerspace.experimental.access',
      'org.homebus.experimental.component.queue',
      'org.homebus.experimental.solar-clock' ].forEach(function(ddc) {
	  // this should be a call to the Homebus library
          client.subscribe('homebus/device/+/' + ddc);
      });
}

function doFail(e) {
    console.log(e);
    console.log("doFail");
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.log("onConnectionLost:" + responseObject.errorMessage);
    }
    console.log("connection lost");
}

// much of this should be inside a Homebus JS class
function onMessageArrived(message) {
    $('.activity-bar').addClass('hr-green');
    setTimeout(function () {
        $('.activity-bar').removeClass('hr-green');
    }, 1000);

//    console.log('onMessageArrived:' + message.payloadString);
//    console.log('topic is ' + message.destinationName, message); 

    // this is the start of what should be hidden by Homebus
    let data = {};

    try {
        data = JSON.parse(message.payloadString);
    } catch(error) {
        console.error("JSON parsing error");
        console.error(message.payloadString);
        return;
    }

    let source, timestamp, ddc, payload; 

    // is it a new style message?
    if(data["source"]) {
        source = data["source"];
        timestamp = data["timestamp"];
        try {
            ddc = data["contents"]["ddc"];
            payload = data["contents"]["payload"];
        } catch(error) {
            return;
        }
    }

    // if there's no source this is an old style message and should be ignored
    if(!source || !payload) return;
    
    processMessage(source, ddc, timestamp, payload, '');
}

function setTimeago(container, timestamp) {
    let d;

    try {
	d = new Date(timestamp*1000);
	$(container + ' .timeago').timeago('update', d.toISOString()); 
    } catch(error) {
	console.error('setTimeago() error:', error, timestamp, $(container).attr('id'));
    }
}

function processMessage(source, ddc, timestamp, payload, leaf = '') {
    if(ddc === 'org.homebus.experimental.image') {
	onImage(source, ddc, timestamp, payload); 
	return; 
    }

    if(ddc === 'org.homebus.experimental.alert') {
	onAlert(source, ddc, timestamp, payload); 
	return; 
    }

    if(source === 'fb405501-aa7d-43be-8f33-310654eb2162' || source === 'fe7568b3-4550-480f-8014-11ce707ea7c6') {
	console.log('access', source);
	onAccess(source, ddc, timestamp, payload);
	return;
    }

//    $('#log').prepend('<tr><td>' + source + '</td><td>' + ddc + '</td><td><pre>' + JSON.stringify(payload).substr(0, 200) + '</pre></td></tr>');

    for(prop in payload) {
	let current_leaf = leaf + '.' + prop;

	// do not recurse into arrays...
	if(typeof payload[prop] === 'object' && !(payload[prop] instanceof Array)) {
            processMessage(source, ddc, timestamp, payload[prop], current_leaf);
	    continue;
	}

	let rewritten_ddc = ddc.replace(/\./g, '-');
	let sel1 = '#' + source + ' .' + rewritten_ddc + current_leaf;
	let sel2 = '[data-homebus-uuid="' + source + '"] .' + rewritten_ddc + current_leaf;
	let sels = [sel1, sel2].join(', ');

	console.log('selectors', sels);

	$(sels).each(function(index) {
	    let transformer_name = $(this).attr('data-transform');

	    if(transformer_name && transforms.hasOwnProperty(transformer_name)) {
		try {
		    let f = transforms[transformer_name];
		    $(this).attr('data-value', JSON.stringify(payload[prop]));
		    $(this).html(f(payload[prop], ddc, payload));
		} catch(error) {
		    console.error('transformer failed: ' + transformer_name, error);
		}
	    } else
		$(this).html(payload[prop]);
	});

	sels = [ sel1 + ' .embedded-timeago', sel2 + ' .embedded-timeago' ].join(', ');
	$(sels).timeago();
    }

    if(timestamp) {
	setTimeago('[data-homebus-uuid="' + source + '"]', timestamp);

	if(leaf == '')
            setTimeago('#page_last_updated', timestamp);
    }
            setTimeago('#page_last_updated', timestamp);
}


function onProjectors(projectors) {
    return;
    if (projectors["name"] == "Unit 2") {
        id = "#unit2_projector_status";
    }
    if (projectors["name"] == "Unit 3") {
        id = "#unit3_projector_status";
    }
    $(id).text(projectors["status"]);
}

function onAccess(source, ddc, timestamp, payload) {
    let sel = '[data-homebus-uuid="' + source + '"]';

    console.log('onAccess', sel);

    $(sel).html('');

    payload["history"].forEach(function(line) {
	let datetime = line["timestamp"];

	if(line["door"] === "laser-access") {
            if(line["action"] === "starting up")
		$(sel).prepend("<li class='list-group-item'>" + line["action"] + "<br><time class='timeago' datetime='" + datetime + "'></time></li>");
	    else
		$(sel).prepend("<li class='list-group-item'>" + line["action"] + " by " + line["person"] + "<br><time class='timeago' datetime='" + datetime + "'></time></li>");
	} else
	    $(sel).prepend("<li class='list-group-item'>" + line["door"] + " " + line["action"] + " by " + line["person"] + "<br><time class='timeago' datetime='" + datetime + "'></time></li>");
    });

    $(sel + ' .timeago').timeago();
}

function onLight(msg, container) {
    if(msg['state'] == 'on') 
    	$('#' + container + ' .brightness').text(msg['brightness'] + '%'); 
    else
    	$('#' + container + ' .brightness').text('off');
}

function onImage(src, ddc, timestamp, payload) {
    // the following replace helps match against ekko-lightbox which uses new Image when initializing
    let data = 'data:' + payload['mime_type'] + ';base64,' +payload['data'].replace(/\n/g,'');
    let container = '[data-homebus-uuid="' + src + '"]';

    if ($(container + ' a[data-toggle="lightbox"]').attr('href') == $('.ekko-lightbox img').attr('src')) $('.ekko-lightbox img').attr('src', data);

    try {
	$(container + ' a[data-toggle="lightbox"]').attr("data-footer", "Last updated: " + new Date(timestamp*1000).toISOString());
    } catch(error) {
	console.error('BAD TIMESTAMP', timestamp, src, error);
    }

    $(container + ' img').attr('src', data);
    $(container + ' a[data-toggle="lightbox"]').attr('href', data);
    let d = new Date();
    if (d - timestamp * 1000 > 5*60*1000) $(container + ' img').attr('src', 'test-pattern.jpg');

    setTimeago(container, timestamp);
}

function onAlert(src, ddc, timestamp, payload) {
    $('#alerts').html('');

    const regex = /\n/g;

    for (let i = 0; i < payload.length; i++) {
	let d = new Date(payload[i].ends*1000);

	let str = `<details><summary>${payload[i].headline}</summary><p>${d.toLocaleString()}</p><p>${payload[i].description.replace(regex, '<br>')}</p></details>`;
	$('#alerts').append(str);
    }
}

/*
 * for the moment we're keeping this for reference; this should be removed after the 3D printer template has been thoroughly tested

function on3DPrinter(src, ddc, timestamp, payload) {
    let id = '#' + src;

    $(id + ' .status').text(payload['status']['state']);
    $(id + ' .filename').text(payload['job']['file']);
    if(payload['job']['progress']) {
        $(id + ' .print-progress').text(payload['job']['progress'].toFixed(2) + '%');
        $(id + ' .print-progress').attr('aria-valuenow', payload['job']['progress'].toFixed(2));
        $(id + ' .print-progress').css("width", + payload['job']['progress'].toFixed(2) + '%');
    }
    $(id + ' .print-time').text(payload['job']['print_time']);
    $(id + ' .print-time-remaining').text(payload['job']['print_time_remaining']);
    if (payload['status']['state'] != 'idle') {
        $(id + ' .job').show();
    }
    $(id + ' .tool-temp').text(payload['temperatures']['tool0_actual']);
    $(id + ' .tool-temp-target').text(payload['temperatures']['tool0_target']);
    $(id + ' .bed-temp').text(payload['temperatures']['bed_actual']);
    $(id + ' .bed-temp-target').text(payload['temperatures']['bed_target']);

    setTimeago(id, timestamp);
}
*/

// Multiline Function String - Nate Ferrero - Public Domain
// from https://stackoverflow.com/questions/4376431/javascript-heredoc
function heredoc(fn) {
    return fn.toString().match(/\/\*\s*([\s\S]*?)\s*\*\//m)[1];
};

function initImageHTML(selector) {
    let cameraHTML = heredoc(function() {
	/*
	  <a data-toggle='lightbox' data-gallery='{GALLERY}' data-title='{NAME}'>
            <h2>{NAME}</h2>
            <img src='test-pattern.jpg' loading='lazy' class='img-fluid img-thumbnail' >
          </a>
          <p>
	    <time class='timeago'></time>
          </p>
	*/
    });

    $(selector).each(function(index) {
	let gallery = $(this).attr('data-gallery-name');
	let name = $(this).attr('data-name');
	let named_html = cameraHTML.replace('{NAME}', name).replace('{NAME}', name);

	if(gallery)
	    named_html = named_html.replace('{GALLERY}', gallery);
	else
	    named_html = named_html.replace(" data-gallery={GALLERY}", '');

	$(this).html(named_html);
    });
};

function init3DPrinterHTML(selector) {
    let printerHTML = heredoc(function() {
	/*
	  <h6 class='org-homebus-experimental-3dprinter status state'></h6>
  	  <div class='job' style='display: none'>
	    <ul>
	      <li>Filename: <span class='org-homebus-experimental-3dprinter job file'></span></li>
	      <li>Progress: <span class='org-homebus-experimental-3dprinter job progress'></span>%</li>
	      <li>Time Remaining: <span class='org-homebus-experimental-3dprinter job progress print_time'></span> of <span class='org-homebus-experimental-3dprinter job print_time_remaining'></span> sec</li>
            </ul>
	  </div>
	  <table class='table'>
	    <tr>
	      <th>temp</th>
	      <th>actual</th>
	      <th>target</th>
	    </tr>
	    <tr>
	      <td>tool</td>
	      <td class='org-homebus-experimental-3dprinter temperatures tool0_actual' data-transform='transform_temperature'></td>
	      <td class='org-homebus-experimental-3dprinter temperatures tool0_target' data-transform='transform_temperature'></td>
	    </tr>
	    <tr>
	      <td>bed</td>
	      <td class='org-homebus-experimental-3dprinter temperatures bed_actual' data-transform='transform_temperature'></td>
	      <td class='org-homebus-experimental-3dprinter temperatures bed_target' data-transform='transform_temperature'></td>
	    </tr>
	  </table>
          <p>
	    <time class='timeago'></time>
          </p>
	*/});

    $(selector).html(printerHTML);
};

function initServerHTML(selector) {
    let serverHTML = heredoc(function() {
	/*
	  <h3 class='org-homebus-experimental-server-status system hostname'></h3>
	  <table class='table table-striped'>
	    <tr>
	      <td>Uptime:</td>
	      <td class='org-homebus-experimental-server-status system uptime' data-transform='transform_seconds_to_dhms'></td>
  	    </tr>
	    <tr>
	      <td>Load Average:</td>
              <td><span class='org-homebus-experimental-server-status load one_minute'></span>/<span class='org-homebus-experimental-server-status load five_minutes'></span>/<span class='org-homebus-experimental-server-status load fifteen_minutes'></span></td>
	    </tr>
	    <tr>
	      <td>Memory:</td>
              <td><span class='org-homebus-experimental-server-status memory free' data-transform='transform_thousands'></span> free/<span class='org-homebus-experimental-server-status memory total'  data-transform='transform_thousands'></span> total</td>
	    </tr>
	    <tr>
	      <td>Filesystems</td>
	    </tr>
	  </table>

	  <table class='table'>
	    <tbody class='org-homebus-experimental-server-status filesystems' data-transform='transform_filesystems'>
	    </tbody>
	  </table>
          <p>
    	    <time class='timeago'></time>
          </p>
	*/
    });
    $(selector).html(serverHTML);
};

function initWeatherHTML(selector) {
    let weatherHTML = heredoc(function() {
	/*
          <h2>{NAME}</h2>
	  <table class='table'>
	  <tr>
	  <td>Temperature</td>
	  <td class='org-homebus-experimental-weather temperature' data-transform='transform_temperature'></td>
	  </tr>
	  <tr>
	  <td>Humidity</td>
	  <td><span class='org-homebus-experimental-weather humidity' data-transform='transform_humidity'></span>%</td>
	  </tr>
	  <tr>
	  <td>Pressure</td>
	  <td class='org-homebus-experimental-weather pressure' data-transform='transform_pressure'></td>
	  </tr>
	  <tr>
	  <td>Conditions</td>
	  <td class='org-homebus-experimental-weather conditions_long'></td>
	  </tr>
	  </table>
	  <p>
            <time class='timeago'></time>
	  </p>
	*/
    });
    $(selector).html(weatherHTML);

    $(selector).each(function(index) {
	let name = $(this).attr('data-name');
	let named_html = weatherHTML.replace('{NAME}', name);
	$(this).html(named_html);
    });
};

function initAlertHTML(selector) {
    let AlertHTML = heredoc(function() {
	/*
	  <h3 class='org-homebus-experimental-alert headline'></h3>
	  <div class='org-homebus-experimental-alert ends'></div>
	  <div class='org-homebus-experimental-alert description'></div>

	  <p class='org-homebus-experimental-alert'>
	    <time class='timeago'></time>
	  </p>

	 */
    });
    $(selector).html(AlertHTML);
};


function initAQIHTML(selector) {
    let AQIHTML = heredoc(function() {
	/*	    
		    <h2>AQI</h2>
		    <table class='table'>
		    <tr>
		    <td>PM2.5</td>
		    <td class='org-homebus-experimental-aqi-pm25 aqi'></td>
		    <td class='org-homebus-experimental-aqi-pm25 condition'></td>
		    </tr>
		    <tr>
		    <td>O3</td>
		    <td class='org-homebus-experimental-aqi-o3 aqi'></td>
		    <td class='org-homebus-experimental-aqi-o3 condition'></td>
		    </tr>
		    </table>
		    <p class='org-homebus-experimental-aqi-pm org-homebus-experimental-aqi-o3'>
		      <time class='timeago'></time>
		    </p>
	*/
    });
    $(selector).html(AQIHTML);
};

function initDeviceHTML(selector) {
    let deviceHTML = heredoc(function() {
	/*
	  <h3 class='org-homebus-experimental-system name'></h3>
	  <table class='table  table-striped'>
	  <tr>
	  <td>ID</td><td>{UUID}</td>
	  </tr>
	  <tr>
	  <td>Platform</td><td class='org-homebus-experimental-system platform'></td>
	  </tr>
	  <tr>
	  <td>Build</td><td class='org-homebus-experimental-system build'></td>
	  </tr>
	  <tr>
	  <td>IP address</td><td class='org-homebus-experimental-system ip'></td>
	  </tr>
	  <tr>
	  <td>MAC address</td><td class='org-homebus-experimental-system mac_addr'></td>
	  </tr>
	  <tr>
	  <td>Platform</td><td class='org-homebus-experimental-system platform'></td>
	  </tr>
	  <tr>
	  <td>Uptime</td><td class='org-homebus-experimental-diagnostic uptime' data-transform='transform_seconds_to_dhms'></td>
	  </tr>
	  <tr>
	  <td>RSSI</td><td class='org-homebus-experimental-diagnostic rssi'></td>
	  </tr>
	  <tr>
	  <td>Free Heap</td><td class='org-homebus-experimental-diagnostic freeheap'></td>
	  </tr>
	  </table>
	  <p>
	    <time class='timeago'></time>
	  </p>
	*/
    });
    $(selector).each(function(index) {
	let uuid = $(this).closest('[data-homebus-uuid]').attr('data-homebus-uuid');
	let named_html = deviceHTML.replace('{UUID}', uuid);

	$(this).html(named_html);
    });};

function initLEDHTML(selector) {
    let ledHTML = heredoc(function() {
	/*
          <td>{NAME}</td>
          <td class='org-homebus-experimental-led-update preset'></td>
          <td class='org-homebus-experimental-led-update animation'></td>
          <td class='org-homebus-experimental-led-update speed'></td>
          <td class='org-homebus-experimental-led-update brightness'></td>
	*/
    });

    $(selector).each(function(index) {
	let name = $(this).attr('data-name');
	let named_html = ledHTML.replace('{NAME}', name).replace('{NAME}', name);

	$(this).html(named_html);
    });
};

function initRoomHTML(selector) {
    let roomHTML = heredoc(function() {
	/*
          <td id='{DOOR_UUID}'><span class='org-pdxhackerspace-experimental-access action' data-transform='transform_lock'></span></td>
          <td>{NAME}</td>
          <td id='{LIGHT_UUID}'><span class='org-homebus-experimental-switch state'></span></td>
          <td><span class='org-homebus-experimental-air-sensor temperature' data-transform='transform_temperature'></span></td>
          <td><span class='org-homebus-experimental-air-sensor humidity'></span>%</td>
          <td><span class='org-homebus-experimental-air-quality-sensor pm1' data-transform='transform_pms'></span></td>
          <td class='org-homebus-experimental-air-quality-sensor tvoc'></td>
          <td class='org-homebus-experimental-light-sensor lux'></td>
          <td class='org-homebus-experimental-light-sensor ir'></td>
          <td id='{CO2_UUID}'><span class='org-homebus-experimental-co2-sensor co2'></span></td>
	*/
    });

    $(selector).each(function(index) {
	let name = $(this).attr('data-name');
	let door_uuid = $(this).attr('data-door-uuid');
	let light_uuid = $(this).attr('data-light-uuid');
	let co2_uuid = $(this).attr('data-co2-uuid');
	let named_html = roomHTML.replace('{NAME}', name).replace('{NAME}', name);

	if(door_uuid)
	    named_html = named_html.replace('{DOOR_UUID}', door_uuid);

	if(light_uuid)
	    named_html = named_html.replace('{LIGHT_UUID}', light_uuid);

	if(co2_uuid)
	    named_html = named_html.replace('{CO2_UUID}', co2_uuid);

	$(this).html(named_html);
    });
};


});
