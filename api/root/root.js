/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;

/**
 * Import helper libraries
 */
const serviceHelper = require('../../lib/helper.js');

const skill = new Skills();

/**
 * @api {get} /ping
 * @apiName ping
 * @apiGroup Root
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     success: 'true'
 *     data: 'pong'
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 400 Bad Request
 *   {
 *     data: Error message
 *   }
 *
 */
function ping(req, res, next) {
  serviceHelper.log('trace', 'ping', 'Ping API called');

  const ackJSON = {
    service: process.env.ServiceName,
    reply: 'pong',
    cpu: serviceHelper.getCpuInfo(),
    mem: serviceHelper.getMemoryInfo(),
    os: serviceHelper.getOsInfo(),
    process: serviceHelper.getProcessInfo(),
  };

  serviceHelper.sendResponse(res, true, ackJSON);
  next();
}
skill.get('/ping', ping);
skill.get('/', ping);

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
 *   HTTPS/1.1 400 Bad Request
 *   {
 *     data: Error message
 *   }
 *
 */
async function healthCheck(req, res, next) {
  serviceHelper.log('trace', 'healthCheck', 'Health check API called');

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
      port: 3984,
    },
    {
      name: 'alfred_hls_service',
      ip: '192.168.1.7',
      port: 3982,
    },
    {
      name: 'alfred_scheduler_service',
      ip: 'alfred_scheduler_service',
      port: 3978,
    },
    {
      name: 'alfred_lights_service',
      ip: 'alfred_lights_service',
      port: 3978,
    },
    {
      name: 'alfred_controller_service',
      ip: 'alfred_controller_service',
      port: 3981,
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
  ];

  let counter = 0;
  servicesToPing.forEach(async (service) => {
    apiURL = `https://${service.ip}:${service.port}/ping?clientaccesskey=${process.env.ClientAccessKey}`;
    serviceHelper.log('trace', 'healthCheck', `Calling: ${apiURL}`);
    try {
      healthCheckData = await serviceHelper.callAlfredServiceGet(apiURL);
    } catch (err) {
      serviceHelper.log('error', 'healthCheck', err.message);
    }
    if (healthCheckData instanceof Error) {
      serviceHelper.log('error', 'healthCheck', `Ping service failed: ${service.name}`);
    } else {
      serviceHelper.log('trace', 'healthCheck', `Ping service ok: ${service.name}`);
      activeServices.push(healthCheckData.data);
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
