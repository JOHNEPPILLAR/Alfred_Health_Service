/**
 * Import external libraries
 */
const { Service } = require('alfred-base');

// Setup service options
const { version } = require('../../package.json');
const serviceName = require('../../package.json').description;
const namespace = require('../../package.json').name;

const options = {
  serviceName,
  namespace,
  serviceVersion: version,
};

// Bind api functions to base class
Object.assign(Service.prototype, require('../api/root/root'));

// Create base service
const service = new Service(options);

async function setupServer() {
  // Setup service
  await service.createRestifyServer();

  // Apply api routes
  service.restifyServer.get('/healthcheck', (req, res, next) =>
    service._healthCheck(req, res, next),
  );
  service.logger.trace(`${service._traceStack()} - Added '/healthcheck' api`);

  // Listen for api requests
  service.listen();
}
setupServer();
