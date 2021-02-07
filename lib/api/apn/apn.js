/**
 * Import external libraries
 */
const debug = require('debug')('Health:API_APN');

/**
 * @type put
 * @path /apn
 */
async function _apn(req, res, next) {
  let dbConnection;
  try {
    debug(`APN api called`);

    const { token } = req.params;

    debug(`Check for valid params`);
    if (typeof token === 'undefined' || token === null) {
      const err = new Error('Missing param: token');
      this.logger.error(`${this._traceStack()} - ${err}`);
      this._sendResponse(res, next, 400, err);
      return false;
    }

    debug(`Update db`);
    const query = {};
    const opts = {
      returnOriginal: false,
      upsert: true,
    };

    const newValues = { $set: { token } };

    debug('Connect to DB');
    dbConnection = await this._connectToDB();

    debug('Query DB');
    const results = await dbConnection
      .db('alfred_push_notification')
      .collection('alfred_push_notification')
      .findOneAndUpdate(query, newValues, opts);

    if (results.ok === 1) {
      this.logger.info(`iOS app used: ${JSON.stringify(req.params)}`);
      this._sendResponse(res, next, 200, { state: 'saved' });
    } else {
      const err = new Error('Failed to save');
      this.logger.error(`${this._traceStack()} - ${err.message}`);
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 500, err);
      }
    }
    return true;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  } finally {
    try {
      debug(`Close DB connection`);
      await dbConnection.close();
    } catch (err) {
      debug('Not able to close DB');
    }
  }
}

module.exports = {
  _apn,
};
