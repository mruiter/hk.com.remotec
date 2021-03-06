'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// http://products.z-wavealliance.org/products/1584

module.exports = new ZwaveDriver(path.basename(__dirname), {
	debug: true,
	capabilities: {
		measure_battery: {
			command_class: 'COMMAND_CLASS_BATTERY',
			command_get: 'BATTERY_GET',
			command_report: 'BATTERY_REPORT',
			command_report_parser: (report, node) => {
				if (report &&
					report.hasOwnProperty('Battery Level') &&
					report['Battery Level'] === 'battery low warning') {
					if (node && node.hasOwnProperty('state') && (!node.state.hasOwnProperty('alarm_battery') || node.state.alarm_battery !== true)) {
						node.state.alarm_battery = true;
						module.exports.realtime(node.device_data, 'alarm_battery', true);
					}
					return 1;
				}
				if (report.hasOwnProperty('Battery Level (Raw)')) {
					if (node && node.hasOwnProperty('state') &&
						(!node.state.hasOwnProperty('alarm_battery') || node.state.alarm_battery !== false) &&
						report['Battery Level (Raw)'][0] > 5) {
						node.state.alarm_battery = false;
						module.exports.realtime(node.device_data, 'alarm_battery', false);
					}
					return report['Battery Level (Raw)'][0];
				}
				return null;
			},
		},
		alarm_battery: {
			command_class: 'COMMAND_CLASS_BATTERY',
		},
	},
});

module.exports.on('initNode', token => {
	const node = module.exports.nodes[token];

	if (node && typeof node.instance.CommandClass.COMMAND_CLASS_CENTRAL_SCENE !== 'undefined') {
		node.instance.CommandClass.COMMAND_CLASS_CENTRAL_SCENE.on('report', (command, report) => {
			if (command.name === 'CENTRAL_SCENE_NOTIFICATION' &&
				report &&
				report.hasOwnProperty('Properties1') &&
				report.Properties1.hasOwnProperty('Key Attributes') &&
				report.hasOwnProperty('Scene Number')) {
				const remoteValue = {
					button: report['Scene Number'].toString(),
					scene: report.Properties1['Key Attributes']
				}
				Homey.manager('flow').triggerDevice('ZRC-90_scene', null, remoteValue, node.deviceData);
			}
		});
	}
});

Homey.manager('flow').on('trigger.ZRC-90_scene', (callback, args, state) => {
	if (!args) return callback('arguments_error', false);
	if (!state) return callback('state_error', false);

	if (args.hasOwnProperty('button') &&
		args.hasOwnProperty('scene') &&
		state.hasOwnProperty('button') &&
		state.hasOwnProperty('scene') &&
		args.button === state.button &&
		args.scene === state.scene) {
		return callback(null, true);
	}
	return callback('unknown_error', false);
});
