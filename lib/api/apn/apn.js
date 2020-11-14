/**
 * @type put
 * @path /apn
 */
async function _apn(req, res, next) {
  let dbConnection;
  try {
    this.logger.debug(`${this._traceStack()} - APN api called`);

    const { token } = req.params;

    this.logger.trace(`${this._traceStack()} - Check for valid params`);
    if (typeof token === 'undefined' || token === null) {
      const err = new Error('Missing param: token');
      this.logger.error(`${this._traceStack()} - ${err}`);
      this._sendResponse(res, next, 400, err);
      return false;
    }

    this.logger.trace(`${this._traceStack()} - Update db`);
    const query = {};
    const opts = {
      returnOriginal: false,
      upsert: true,
    };

    const newValues = { $set: { token } };
    dbConnection = await this._connectToDB();
    const results = await dbConnection
      .db('alfred_push_notification')
      .collection('alfred_push_notification')
      .findOneAndUpdate(query, newValues, opts);

    if (results.ok === 1) {
      this.logger.info(`Saved sensor data: ${JSON.stringify(req.params)}`);
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
    this.logger.trace(`${this._traceStack()} - Close DB connection`);
    await dbConnection.close();
  }
}

module.exports = {
  _apn,
};
