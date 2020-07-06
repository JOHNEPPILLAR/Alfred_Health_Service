/**
 * @type put
 * @path /apn
 */
async function _apn(req, res, next) {
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

    this.logger.trace(`${this._traceStack()} - Updated db`);
    const sql = 'UPDATE ios_devices SET device_token = $1';
    const sqlValues = [token];

    this.logger.trace(`${this._traceStack()} - Connect to db`);
    const dbConnection = await this._connectToDB('devices');
    this.logger.trace(`${this._traceStack()} - Execute sql`);
    const results = await dbConnection.query(sql, sqlValues);
    this.logger.trace(
      `${this._traceStack()} - Release the data store connection back to the pool`,
    );
    await dbConnection.end(); // Close data store connection

    // Send data back to caler
    if (results.rowCount === 1) {
      this.logger.trace(
        `${this._traceStack()} - Saved token data: ${JSON.stringify(
          req.params,
        )}`,
      );
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 200, { state: 'saved' });
      }
      return true;
    }
    if (typeof res !== 'undefined' && res !== null) {
      const err = new Error('Failed to save');
      this.logger.error(`${this._traceStack()} - ${err.message}`);
      this._sendResponse(res, next, 500, err);
      return err;
    }
    return true;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  }
}

module.exports = {
  _apn,
};
