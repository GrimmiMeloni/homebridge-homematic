'use strict'

var HomeKitGenericService = require('homebridge-homematic/ChannelServices/HomeKitGenericService.js').HomeKitGenericService
var util = require('util')

function HomeMaticHomeKitRadiatorThermostatServiceIP(log, platform, id, name, type, adress, special, cfg, Service, Characteristic) {
  HomeMaticHomeKitRadiatorThermostatServiceIP.super_.apply(this, arguments)
}

util.inherits(HomeMaticHomeKitRadiatorThermostatServiceIP, HomeKitGenericService)

HomeMaticHomeKitRadiatorThermostatServiceIP.prototype.createDeviceService = function (Service, Characteristic) {
  var that = this
  this.usecache = false
  var thermo = new Service['Thermostat'](this.name)
  this.services.push(thermo)
  this.enableLoggingService('radiator')

  this.log.debug('[Radiator] id %s, name %s, type %s, adress %s', this.id, this.name, this.type, this.adress)

  var mode = thermo.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
    .on('get', function (callback) {
      that.query('SET_POINT_TEMPERATURE', function (value) {
        if (value < 6.0) {
          that.getCurrentStateCharacteristic('CONTROL_MODE').setValue(1, null)
          if (callback) callback(null, 0)
        } else {
          that.getCurrentStateCharacteristic('CONTROL_MODE').setValue(0, null)
          if (callback) callback(null, 1)
        }
      })
    })

  this.setCurrentStateCharacteristic('CONTROL_MODE', mode)
  mode.eventEnabled = true

  var targetMode = thermo.getCharacteristic(Characteristic.TargetHeatingCoolingState)
    .on('get', function (callback) {
      that.query('SET_POINT_TEMPERATURE', function (value) {
        if (value < 6.0) {
          if (callback) callback(null, 0)
        } else {
          if (callback) callback(null, 1)
        }
      })
    })

    .on('set', function (value, callback) {
      if (value === 0) {
        this.command('setrega', 'SET_POINT_TEMPERATURE', 0)
        this.cleanVirtualDevice('SET_POINT_TEMPERATURE')
      } else {
        this.cleanVirtualDevice('SET_POINT_TEMPERATURE')
      }
      callback()
    }.bind(this))

  targetMode.setProps({
    format: Characteristic.Formats.UINT8,
    perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY],
    maxValue: 1,
    minValue: 0,
    minStep: 1
  })

  this.cctemp = thermo.getCharacteristic(Characteristic.CurrentTemperature)
    .setProps({ minValue: -100 })
    .on('get', function (callback) {
      this.remoteGetValue('ACTUAL_TEMPERATURE', function (value) {
        if (callback) callback(null, value)
      })
    }.bind(this))

  this.cctemp.eventEnabled = true

  this.ttemp = thermo.getCharacteristic(Characteristic.TargetTemperature)
    .setProps({ minValue: 6.0, maxValue: 30.5, minStep: 0.1 })
    .on('get', function (callback) {
      this.query('SET_POINT_TEMPERATURE', function (value) {
        if (value < 6) {
          value = 6
        }
        if (value > 30) {
          value = 30.5
        }
        if (callback) callback(null, value)
      })
    }.bind(this))

    .on('set', function (value, callback) {
      this.delayed('setrega', 'SET_POINT_TEMPERATURE', value, 500)
      callback()
    }.bind(this))

  this.ttemp.eventEnabled = true

  thermo.getCharacteristic(Characteristic.TemperatureDisplayUnits)
    .on('get', function (callback) {
      if (callback) callback(null, Characteristic.TemperatureDisplayUnits.CELSIUS)
    })

  this.remoteGetValue('SET_POINT_TEMPERATURE')
  this.queryData()
}

HomeMaticHomeKitRadiatorThermostatServiceIP.prototype.queryData = function () {
  var that = this

  this.query('ACTUAL_TEMPERATURE', function (value) {
    that.cctemp.updateValue(parseFloat(value), null)
    that.addLogEntry({ currentTemp: parseFloat(value) })
  })

  // create timer to query device every 10 minutes
  this.refreshTimer = setTimeout(function () { that.queryData() }, 10 * 60 * 1000)
}

HomeMaticHomeKitRadiatorThermostatServiceIP.prototype.shutdown = function () {
  clearTimeout(this.refreshTimer)
}

HomeMaticHomeKitRadiatorThermostatServiceIP.prototype.datapointEvent = function (dp, newValue) {
  if (this.isDataPointEvent(dp, 'ACTUAL_TEMPERATURE')) {
    this.cctemp.updateValue(parseFloat(newValue), null)
    this.addLogEntry({ currentTemp: parseFloat(newValue) })
  }

  if (this.isDataPointEvent(dp, 'SET_POINT_TEMPERATURE')) {
    this.ttemp.updateValue(parseFloat(newValue), null)
    this.addLogEntry({ setTemp: parseFloat(newValue) })
  }
}

module.exports = HomeMaticHomeKitRadiatorThermostatServiceIP
