/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;
const serviceHelper = require('alfred-helper');

const skill = new Skills();

global.inActiveServices = [];

/**
 * @type get
 * @path /
 */
async function ping(req, res, next) {
  serviceHelper.ping(res, next);
}
skill.get(
  '/ping',
  ping,
);

/**
 * @type get
 * @path /healthcheck
 */
async function healthCheck(req, res, next) {
  serviceHelper.log(
    'trace',
    'Health check API called',
  );

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
      name: 'alfred_controller_service',
      ip: 'alfred_controller_service',
      port: 3978,
      withKey: true,
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

  serviceHelper.log(
    'trace',
    'Getting ClientAccessKey',
  );
  const ClientAccessKey = await serviceHelper.vaultSecret(
    process.env.ENVIRONMENT,
    'ClientAccessKey',
  );
  if (ClientAccessKey instanceof Error) {
    serviceHelper.log(
      'error',
      'Not able to get secret (ClientAccessKey) from vault',
    );
    serviceHelper.sendResponse(
      res,
      500,
      new Error('There was a problem with the auth service'),
    );
    return;
  }
  const SlackWebHook = await serviceHelper.vaultSecret(
    process.env.ENVIRONMENT,
    'SlackWebHook',
  );
  if (SlackWebHook instanceof Error) {
    serviceHelper.log(
      'error',
      'Not able to get secret (SlackWebHook) from vault',
    );
    serviceHelper.sendResponse(
      res,
      500,
      new Error('There was a problem with the auth service'),
    );
    return;
  }

  let counter = 0;
  servicesToPing.map(async (service) => {
    apiURL = `https://${service.ip}:${service.port}/ping`;
    if (service.withKey) {
      apiURL = `https://${service.ip}:${service.port}/ping?clientaccesskey=${ClientAccessKey}`;
    }
    serviceHelper.log(
      'trace',
      `Calling: ${apiURL}`,
    );
    try {
      healthCheckData = await serviceHelper.callAlfredServiceGet(apiURL);
    } catch (err) {
      serviceHelper.log(
        'error',
        err.message,
      );
    }
    if (healthCheckData instanceof Error) {
      serviceHelper.log(
        'error',
        `Ping service failed: ${service.name}`,
      );
      inActiveCount += 1;

      if (global.inActiveServices.indexOf(service.name) === -1) {
        serviceHelper.log(
          'info',
          `Service: ${service.name} is not working, notify slack`,
        );
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
          const apiData = await serviceHelper.callAPIServicePut(
            SlackWebHook,
            slackMessageBody,
          );
          if (apiData instanceof Error) serviceHelper.log('error', apiData);
        } catch (err) {
          serviceHelper.log(
            'error',
            err.message,
          );
        }
      } else {
        serviceHelper.log(
          'info',
          `Service: ${service.name} is still not working`,
        );
      }
    } else {
      serviceHelper.log(
        'trace',
        `Ping service ok: ${service.name}`,
      );
      const alertIndex = global.inActiveServices.indexOf(service.name);
      if (alertIndex > -1) {
        serviceHelper.log(
          'info',
          `Service: ${service.name} is now working, notify slack`,
        );
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
          const apiData = await serviceHelper.callAPIServicePut(
            SlackWebHook,
            slackMessageBody,
          );
          if (apiData instanceof Error) serviceHelper.log('error', apiData);
        } catch (err) {
          serviceHelper.log(
            'error',
            err.message,
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
      serviceHelper.sendResponse(
        res,
        200,
        returnJSON,
      );
      next();
    }
  });
}
skill.get(
  '/healthcheck',
  healthCheck,
);

module.exports = skill;
