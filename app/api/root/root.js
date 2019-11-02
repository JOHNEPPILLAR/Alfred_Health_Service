/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;
const serviceHelper = require('alfred-helper');

const skill = new Skills();

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

  const servicesToPing = [
    {
      name: 'alfred_iot_battery_service',
      ip: 'alfred_iot_battery_service',
      port: 3978,
    },
    {
      name: 'alfred_flowercare_data_collector_service',
      ip: '192.168.1.7',
      port: 3978,
    },
    {
      name: 'alfred_hls_service',
      ip: '192.168.1.7',
      port: 3980,
    },
    // {
    //  name: 'alfred_scheduler_service',
    //  ip: 'alfred_scheduler_service',
    //  port: 3978,
    // },
    {
      name: 'alfred_lights_service',
      ip: 'alfred_lights_service',
      port: 3978,
    },
    // {
    //  name: 'alfred_controller_service',
    //  ip: '192.168.1.3',
    //  port: 3981,
    // },
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
    } else {
      serviceHelper.log('trace', `Ping service ok: ${service.name}`);
      activeServices.push(service.name);
      activeCount += 1;
    }
    counter += 1;
    if (counter === servicesToPing.length) {
      const returnJSON = {
        activeCount,
        activeServices,
      };
      serviceHelper.sendResponse(res, true, returnJSON);
      next();
    }
  });
}
skill.get('/healthcheck', healthCheck);

module.exports = skill;
