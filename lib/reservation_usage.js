const EC2 = require('./ec2')
const ReservationManager = require('./reservation_manager')

module.exports = class ReservationUsage {
  constructor(env = null, ec2 = null) {
    this._env = env || process.env
    this._ec2 = ec2 || new EC2()
  }

  processEvent(event) {
    return this._load(this._findRegion(event))
      .then(([reservations, instances]) => this._matchReservations(reservations, instances))
      .then(summary => this._formatResponse(event, summary))
  }

  _findRegion(event) {
    let region = null
    if (this._isApiGatewayEvent(event)) {
      region = event.queryStringParameters.region
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

  _matchReservations(reservations, instances) {
    const reservationManager = new ReservationManager(reservations)
    const unreservedInstances = []
    instances.forEach((instance) => {
      const reservation = reservationManager.consumeReservedCapacity(instance)
      if (reservation == null) {
        unreservedInstances.push(instance)
      }
    })
    return this._summarizeFindings(
      instances,
      unreservedInstances,
      reservations,
      reservationManager.unusedReservedCapacity()
    )
  }

  _summarizeFindings(instances, unreservedInstances, reservations, unusedReservations) {
    const summaries = {
      running: this._summarizeByFamily(instances, 'units'),
      reserved: this._summarizeByFamily(reservations, 'units'),
      unreserved: this._summarizeByFamily(unreservedInstances, 'units'),
      surplus: this._summarizeByFamily(unusedReservations, 'remainingUnits'),
    }
    const families = this._sortedKeys(summaries.running, summaries.reserved)
    return families.map((family) => {
      const row = {family}
      for (let column in summaries) {
        row[column] = summaries[column][family] || 0
      }
      return row
    })
  }

  _summarizeByFamily(objs, property) {
    const summary = {}
    objs.forEach((instance) => {
      summary[instance.family] = (summary[instance.family] || 0) + instance[property]
    })
    return summary
  }

  _formatResponse(event, summary) {
    if (this._isApiGatewayEvent(event)) {
      const jsonResponse = this._acceptsJson(event)
      const contentType = jsonResponse ? 'application/json' : 'text/plain; charset=UTF-8'
      const body = jsonResponse ? JSON.stringify(summary) : this._plainTextSummary(summary)
      return {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
        },
        body,
      }
    } else {
      return summary
    }
  }

  _acceptsJson(apiGatewayEvent) {
    return /application\/json/.test(apiGatewayEvent.headers.Accept)
  }

  _plainTextSummary(summary) {
    let str = '       running   reserved unreserved    surplus\n'
    for (let row of summary) {
      str += row.family + ' '
      str += ' ' + this._leftPad(row.running.toString(), ' ', 10)
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

  _sortedKeys(...objs) {
    let keys = objs.reduce((keys, o) => keys.concat(Object.keys(o)), [])
    keys = new Set(keys)
    keys = [...keys].sort()
    return keys
  }
}
