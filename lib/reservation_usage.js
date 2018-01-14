const querystring = require('querystring')
const EC2 = require('./ec2')
const Summarizer = require('./summarizer')

const AUTHENTICATION_ERROR = new Error('Authentication error')

class SlackAuthentication {
  constructor(verificationToken) {
    this._verificationToken = verificationToken
  }

  authenticate(event) {
    const parameters = querystring.parse(event.body)
    if (parameters.token === this._verificationToken) {
      return Promise.resolve(event)
    } else {
      return Promise.reject(AUTHENTICATION_ERROR)
    }
  }
}

class NoAuthentication {
  authenticate(event) {
    return Promise.resolve(event)
  }
}

class JsonFormatter {
  formatResponse(summary) {
    return summary
  }

  formatErrorResponse(error) {
    throw error
  }
}

class ApiGatewayFormatter {
  constructor(event) {
    this._event = event
  }

  formatResponse(summary) {
    let contentType = null
    let body = null
    if (this._event.headers.Accept === 'text/plain') {
      contentType = 'text/plain; charset=UTF-8'
      body = this._plainTextSummary(summary)
    } else {
      contentType = 'application/json'
      body = JSON.stringify(summary)
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
      },
      body,
    }
  }

  formatErrorResponse(error) {
    if (error === AUTHENTICATION_ERROR) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'Authentication error',
      }
    } else {
      throw error
    }
  }

  _plainTextSummary(summary) {
    let str = '  '
    str += ' ' + this._leftPad('on demand', ' ', 10)
    str += ' ' + this._leftPad('spot', ' ', 10)
    str += ' ' + this._leftPad('emr', ' ', 10)
    str += ' ' + this._leftPad('reserved', ' ', 10)
    str += ' ' + this._leftPad('unreserved', ' ', 10)
    str += ' ' + this._leftPad('surplus', ' ', 10)
    str += '\n'
    for (let row of summary) {
      str += row.family
      str += ' ' + this._leftPad(row.onDemand.toString(), ' ', 10)
      str += ' ' + this._leftPad(row.spot.toString(), ' ', 10)
      str += ' ' + this._leftPad(row.emr.toString(), ' ', 10)
      str += ' ' + this._leftPad(row.reserved.toString(), ' ', 10)
      str += ' ' + this._leftPad(row.unreserved.toString(), ' ', 10)
      str += ' ' + this._leftPad(row.surplus.toString(), ' ', 10)
      str += '\n'
    }
    return str
  }

  _leftPad(str, pad, n) {
    let padding = ''
    for (let i = 0; i < Math.max(0, n - str.length); i++) {
      padding += pad
    }
    return padding + str
  }
}

class SlackFormatter extends ApiGatewayFormatter {
  constructor(event, region) {
    super(event)
    this._region = region
  }

  formatResponse(summary) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        response_type: 'in_channel',
        text: this._formatBody(summary),
        mrkdwn: true,
      }),
    }
  }

  _formatBody(summary) {
    return [
      `The number of small-equivalents currently running and reserved in ${this._region}`,
      '```',
      this._plainTextSummary(summary),
      '```',
    ].join('\n')
  }
}

module.exports = class ReservationUsage {
  constructor(env = null, ec2 = null) {
    this._env = env || process.env
    this._ec2 = ec2 || new EC2()
  }

  processEvent(event) {
    const authenticator = this._createAuthenticator(event)
    const formatter = this._createResponseFormatter(event)
    return authenticator.authenticate(event)
      .then((event) => {
        return this._load(this._findRegion(event))
          .then(([reservations, instances]) => this._summarize(reservations, instances))
          .then(summary => formatter.formatResponse(summary))
      })
      .catch((error) => formatter.formatErrorResponse(error))
  }

  _summarize(reservations, instances) {
    return new Summarizer(reservations, instances).summarize()
  }

  _createAuthenticator(event) {
    if (this._isApiGatewayEvent(event)) {
      return new SlackAuthentication(this._env.VERIFICATION_TOKEN)
    } else {
      return new NoAuthentication()
    }
  }

  _createResponseFormatter(event) {
    if (this._isApiGatewayEvent(event)) {
      if (this._isSlackEvent(event)) {
        return new SlackFormatter(event, this._findRegion(event))
      } else {
        return new ApiGatewayFormatter(event)
      }
    } else {
      return new JsonFormatter(event)
    }
  }

  _findRegion(event) {
    let region = null
    if (this._isApiGatewayEvent(event)) {
      const parameters = querystring.parse(event.body)
      region = parameters.text
    }
    return region || this._env['AWS_DEFAULT_REGION']
  }

  _isApiGatewayEvent(event) {
    return 'requestContext' in event
  }

  _load(region) {
    return Promise.all([
      this._ec2.loadReservations(region),
      this._ec2.loadInstances(region),
    ])
  }

  _isSlackEvent(apiGatewayEvent) {
    return /^Slackbot/.test(apiGatewayEvent.headers['User-Agent'])
  }
}
