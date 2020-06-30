/**
 * Import external libraries
 */
//const serviceHelper = require('alfred-helper');

global.inActiveServices = [];

/**
 * @type get
 * @path /healthcheck
 */
async function _healthCheck(req, res, next) {
  this.logger.debug(`${this._traceStack()} - Health check api called`);

  const activeServices = [];

  let apiURL;
  let healthCheckData;
  let activeCount = 0;
  let inActiveCount = 0;

  const servicesToPing = [
    {
      name: 'alfred_lights_service',
      ip: 'alfred_lights_service',
      port: 3978,
      withKey: false,
    },
    {
      name: 'alfred_hls_service',
      ip: '192.168.85.13',
      port: 3980,
      withKey: true,
    },
    {
      name: 'alfred_flowercare_data_collector_service',
      ip: '192.168.85.13',
      port: 3981,
      withKey: false,
    },
    {
      name: 'alfred_iot_battery_service',
      ip: 'alfred_iot_battery_service',
      port: 3978,
      withKey: false,
    },
    {
      name: 'alfred_netatmo_data_collector_service',
      ip: 'alfred_netatmo_data_collector_service',
      port: 3978,
      withKey: false,
    },
    {
      name: 'alfred_dyson_data_collector_service',
      ip: 'alfred_dyson_data_collector_service',
      port: 3978,
      withKey: false,
    },
    {
      name: 'alfred_weather_service',
      ip: 'alfred_weather_service',
      port: 3978,
      withKey: false,
    },
    {
      name: 'alfred_commute_service',
      ip: 'alfred_commute_service',
      port: 3978,
      withKey: false,
    },
    {
      name: 'alfred_tp_link_service',
      ip: 'alfred_tp_link_service',
      port: 3978,
      withKey: false,
    },
  ];

  const SlackWebHook = await this._getVaultSecret.call(
    this,
    process.env.ENVIRONMENT,
    'SlackWebHook',
  );
  if (SlackWebHook instanceof Error) {
    const err = new Error('There was a problem with the auth service');
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    this._sendResponse(res, next, 500, err);
    return;
  }

  let counter = 0;
  servicesToPing.map(async (service) => {
    apiURL = `https://${service.ip}:${service.port}/ping${
      service.withKey ? `?clientaccesskey=${this.apiAccessKey}` : ''
    }`;
    this.logger.trace(`${this._traceStack()} - Calling: ${apiURL}`);
    try {
      healthCheckData = await this._callAlfredServiceGet.call(this, apiURL);
    } catch (err) {
      this.logger.error(`${this._traceStack()} - ${err.message}`);
    }

    const slackMessageBody = {
      username: 'Error notifier',
      text: 'Service is off-line',
      icon_emoji: ':bangbang:',
      attachments: [
        {
          color: '#ff0000',
          fields: [
            {
              title: 'Environment',
              value: 'Production',
              short: true,
            },
            {
              title: 'Service',
              value: service.name,
              short: true,
            },
          ],
        },
      ],
    };

    if (healthCheckData instanceof Error) {
      this.logger.error(
        `${this._traceStack()} - Ping service failed: ${service.name}`,
      );
      inActiveCount += 1;

      if (global.inActiveServices.indexOf(service.name) === -1) {
        this.logger.trace(
          `${this._traceStack()} - Service: ${
            service.name
          } is not working, notify slack`,
        );
        global.inActiveServices.push(service.name);
        try {
          const apiData = await this._callAPIServicePut.call(
            this,
            SlackWebHook,
            slackMessageBody,
          );
          if (apiData instanceof Error) {
            this.logger.error(
              `${this._traceStack()} - Ping failed: ${apiData.name}`,
            );
          }
        } catch (err) {
          this.logger.error(
            `${this._traceStack()} - Ping failed: ${err.message}`,
          );
        }
      } else {
        this.logger.trace(
          `${this._traceStack()} - Service: ${
            service.name
          } is still not working`,
        );
      }
    } else {
      this.logger.trace(
        `${this._traceStack()} - Service: ${service.name} service ok`,
      );
      const alertIndex = global.inActiveServices.indexOf(service.name);
      if (alertIndex > -1) {
        this.logger.trace(
          `${this._traceStack()} - Service: ${
            service.name
          } is now working, notify slack`,
        );
        global.inActiveServices.splice(alertIndex, 1);
        slackMessageBody.text = 'Service is back on-line';
        slackMessageBody.icon_emoji = ':smile:';
        slackMessageBody.attachments[0].color = '#00FF00';

        try {
          const apiData = await this._callAPIServicePut.call(
            this,
            SlackWebHook,
            slackMessageBody,
          );
          if (apiData instanceof Error) {
            this.logger.error(
              `${this._traceStack()} - Ping failed: ${apiData.message}`,
            );
          }
        } catch (err) {
          this.logger.error(
            `${this._traceStack()} - Ping failed: ${err.message}`,
          );
        }
      }
      activeServices.push(service.name);
      activeCount += 1;
    }
    counter += 1;
    if (counter === servicesToPing.length) {
      const returnJSON = {
        inActiveCount,
        activeCount,
        activeServices,
        inActiveServices: global.inActiveServices,
      };
      this._sendResponse(res, next, 200, returnJSON);
    }
  });
}

module.exports = {
  _healthCheck,
};
