/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;
const serviceHelper = require('alfred-helper');

const skill = new Skills();

const slackAPIURL = process.env.SlackWebHook;

global.inActiveServices = [];

/**
 * @api {get} /ping
 * @apiName ping
 * @apiGroup Root
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     data: 'pong'
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 500 Internal error
 *   {
 *     data: Error message
 *   }
 *
 */
async function ping(req, res, next) {
  serviceHelper.ping(res, next);
}
skill.get('/ping', ping);

/**
 * @api {get} /healthcheck
 * @apiName healthcheck
 * @apiGroup Root
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     success: 'true'
 *     data: {
 *       activeCount: 0
 *     }
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 500 Internal error
 *   {
 *     data: Error message
 *   }
 *
 */
async function healthCheck(req, res, next) {
  serviceHelper.log('trace', 'Health check API called');

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
    },
    {
      name: 'alfred_hls_service',
      ip: '192.168.1.7',
      port: 3980,
    },
    {
      name: 'alfred_flowercare_data_collector_service',
      ip: '192.168.1.7',
      port: 3978,
    },
    {
      name: 'alfred_iot_battery_service',
      ip: 'alfred_iot_battery_service',
      port: 3978,
    },
    {
      name: 'alfred_netatmo_data_collector_service',
      ip: 'alfred_netatmo_data_collector_service',
      port: 3978,
    },
    {
      name: 'alfred_dyson_data_collector_service',
      ip: 'alfred_dyson_data_collector_service',
      port: 3978,
    },
    {
      name: 'alfred_controller_service',
      ip: '192.168.1.3',
      port: 3981,
    },
    {
      name: 'alfred_commute_service',
      ip: 'alfred_commute_service',
      port: 3978,
    },
    {
      name: 'alfred_tp_link_service',
      ip: 'alfred_tp_link_service',
      port: 3978,
    },
  ];

  let counter = 0;
  servicesToPing.forEach(async (service) => {
    apiURL = `https://${service.ip}:${service.port}/ping?clientaccesskey=${process.env.ClientAccessKey}`;
    serviceHelper.log('trace', `Calling: ${apiURL}`);
    try {
      healthCheckData = await serviceHelper.callAlfredServiceGet(apiURL);
    } catch (err) {
      serviceHelper.log('error', err.message);
    }
    if (healthCheckData instanceof Error) {
      serviceHelper.log('error', `Ping service failed: ${service.name}`);
      inActiveCount += 1;

      if (global.inActiveServices.indexOf(service.name) === -1) {
        serviceHelper.log('info', `Service: ${service.name} is not working, notify slack`);
        global.inActiveServices.push(service.name);
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
        try {
          const apiData = await serviceHelper.callAPIServicePut(slackAPIURL, slackMessageBody);
          if (apiData instanceof Error) serviceHelper.log('error', apiData);
        } catch (err) {
          serviceHelper.log('error', err.message);
        }
      } else {
        serviceHelper.log('info', `Service: ${service.name} is still not working`);
      }
    } else {
      serviceHelper.log('trace', `Ping service ok: ${service.name}`);
      const alertIndex = global.inActiveServices.indexOf(service.name);
      if (alertIndex > -1) {
        serviceHelper.log('info', `Service: ${service.name} is now working, notify slack`);
        global.inActiveServices.splice(alertIndex, 1);
        const slackMessageBody = {
          username: 'Error notifier',
          text: 'Service is back on-line',
          icon_emoji: ':smile:',
          attachments: [
            {
              color: '#00FF00',
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
        try {
          const apiData = await serviceHelper.callAPIServicePut(slackAPIURL, slackMessageBody);
          if (apiData instanceof Error) serviceHelper.log('error', apiData);
        } catch (err) {
          serviceHelper.log('error', err.message);
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
      };
      serviceHelper.sendResponse(res, 200, returnJSON);
      next();
    }
  });
}
skill.get('/healthcheck', healthCheck);

module.exports = skill;
