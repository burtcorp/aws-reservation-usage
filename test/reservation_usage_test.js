const {describe, it, beforeEach} = require('mocha')
const {expect} = require('chai')
const ReservationUsage = require('../lib/reservation_usage')

require('mocha-define') /* global def */

describe('ReservationUsage', function () {
  def('reservationUsage', function () {
    return new ReservationUsage(this.env, this.ec2)
  })

  beforeEach(function () {
    this.env = {
      AWS_DEFAULT_REGION: 'eu-north-3',
      VERIFICATION_TOKEN: 'secret',
    }
  })

  beforeEach(function () {
    this.ec2 = {
      reservations: [],
      instances: [],
      loadReservations(region) {
        this.requestedReservationRegion = region
        return Promise.resolve(this.reservations)
      },
      loadInstances(region) {
        this.requestedInstancesRegion = region
        return Promise.resolve(this.instances)
      },
    }
  })

  beforeEach(function () {
    this.event = {}
  })

  describe('#processEvent', function () {
    beforeEach(function () {
      this.ec2.instances.push({family: 'i9', size: 'large', units: 4, spot: false, emr: false})
      this.ec2.instances.push({family: 'p7', size: 'large', units: 4, spot: false, emr: false})
      this.ec2.instances.push({family: 'd5', size: 'large', units: 4, spot: false, emr: false})
      this.ec2.instances.push({family: 'c6', size: 'large', units: 4, spot: true, emr: false})
      this.ec2.instances.push({family: 'i9', size: 'large', units: 4, spot: false, emr: true})
      this.ec2.reservations.push({family: 'p7', size: 'small', offeringClass: 'convertible', units: 8})
      this.ec2.reservations.push({family: 'i9', size: 'small', offeringClass: 'convertible', units: 18})
      this.ec2.reservations.push({family: 'i9', size: 'small', offeringClass: 'convertible', units: 4})
      this.ec2.reservations.push({family: 'i9', size: 'small', offeringClass: 'convertible', units: 2})
    })

    describe('when the event is an API Gateway event', function () {
      beforeEach(function () {
        this.event = {
          requestContext: {},
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Slackbot 1.0',
          },
          body: 'hello=world&token=secret&foo=bar&text=eu-north-9'
        }
      })

      describe('and the request does not include the expected validation token', function () {
        beforeEach(function () {
          this.event.body = 'hello=world'
        })

        it('returns a 401 error response', function () {
          return this.reservationUsage.processEvent(this.event).then((response) => {
            expect(response.statusCode).to.equal(401)
            expect(response.body).to.match(/authentication/i)
            expect(response.headers['Content-Type']).to.match(/^text\/plain/)
          })
        })
      })

      it('returns an API Gateway-compatible response', function () {
        return this.reservationUsage.processEvent(this.event).then((response) => {
          expect(response.statusCode).to.equal(200)
          expect(response.body).to.not.be.undefined
          expect(response.headers).to.not.be.undefined
        })
      })

      it('returns a plain text summary', function () {
        return this.reservationUsage.processEvent(this.event).then((response) => {
          expect(response.statusCode).to.equal(200)
          expect(response.body).to.match(/on demand\s+spot\s+emr\s+reserved\s+unreserved\s+surplus/)
          expect(response.headers['Content-Type']).to.equal('text/plain; charset=UTF-8')
        })
      })

      it('loads instances and reservations for the specified region', function () {
        return this.reservationUsage.processEvent(this.event).then(() => {
          expect(this.ec2.requestedReservationRegion).to.equal('eu-north-9')
          expect(this.ec2.requestedInstancesRegion).to.equal('eu-north-9')
        })
      })

      describe('when the region is not specified', function () {
        beforeEach(function () {
          this.event.body = 'hello=world&token=secret'
        })

        it('loads instances and reservations for the region specified in the AWS_DEFAULT_REGION environment variable', function () {
          return this.reservationUsage.processEvent(this.event).then(() => {
            expect(this.ec2.requestedReservationRegion).to.equal('eu-north-3')
            expect(this.ec2.requestedInstancesRegion).to.equal('eu-north-3')
          })
        })
      })

      describe('whent he "Accept" header contains "application/json"', function () {
        beforeEach(function () {
          this.event.headers = {Accept: 'text/plain, application/json, */*'}
        })

        it('returns a JSON string as the body and sets the content type to JSON', function () {
          return this.reservationUsage.processEvent(this.event).then((response) => {
            expect(response.statusCode).to.equal(200)
            expect(response.body).to.match(/^\[\{"family/)
            expect(response.headers['Content-Type']).to.equal('application/json')
          })
        })

        describe('but the user agent indicates that the request comes from Slack', function () {
          beforeEach(function () {
            this.event.headers['User-Agent'] = 'Slackbot 1.0'
          })

          it('returns a plain text summary', function () {
            return this.reservationUsage.processEvent(this.event).then((response) => {
              expect(response.statusCode).to.equal(200)
              expect(response.body).to.match(/on demand\s+spot\s+emr\s+reserved\s+unreserved\s+surplus/)
              expect(response.headers['Content-Type']).to.equal('text/plain; charset=UTF-8')
            })
          })

          it('wraps the plain text in ``` to preserve formatting', function () {
            return this.reservationUsage.processEvent(this.event).then((response) => {
              expect(response.body).to.match(/^```\n/)
              expect(response.body).to.match(/\n```\n$/)
            })
          })
        })
      })
    })

    describe('when the event any non-API Gateway-event', function () {
      describe('returns a summary that', function () {
        it('contains the families of the instances and reservations, in alphabetical order', function () {
          return this.reservationUsage.processEvent(this.event).then((response) => {
            expect(response.map(s => s.family)).to.deep.equal([
              'c6',
              'd5',
              'i9',
              'p7',
            ])
          })
        })

        it('contains the the number of running on demand units for each instance family', function () {
          return this.reservationUsage.processEvent(this.event).then((response) => {
            expect(response.map(s => [s.family, s.onDemand])).to.deep.equal([
              ['c6', 0],
              ['d5', 4],
              ['i9', 4],
              ['p7', 4],
            ])
          })
        })

        it('contains the the number of running spot units for each instance family', function () {
          return this.reservationUsage.processEvent(this.event).then((response) => {
            expect(response.map(s => [s.family, s.spot])).to.deep.equal([
              ['c6', 4],
              ['d5', 0],
              ['i9', 0],
              ['p7', 0],
            ])
          })
        })

        it('contains the the number of running EMR units for each instance family', function () {
          return this.reservationUsage.processEvent(this.event).then((response) => {
            expect(response.map(s => [s.family, s.emr])).to.deep.equal([
              ['c6', 0],
              ['d5', 0],
              ['i9', 4],
              ['p7', 0],
            ])
          })
        })

        it('contains the the number of reserved units for each instance family', function () {
          return this.reservationUsage.processEvent(this.event).then((response) => {
            expect(response.map(s => [s.family, s.reserved])).to.deep.equal([
              ['c6', 0],
              ['d5', 0],
              ['i9', 18 + 4 + 2],
              ['p7', 8],
            ])
          })
        })

        it('contains the the number of unreserved units for each instance family', function () {
          return this.reservationUsage.processEvent(this.event).then((response) => {
            expect(response.map(s => [s.family, s.unreserved])).to.deep.equal([
              ['c6', 0],
              ['d5', 4],
              ['i9', 0],
              ['p7', 0],
            ])
          })
        })

        it('contains the the number of unused reserved units for each instance family', function () {
          return this.reservationUsage.processEvent(this.event).then((response) => {
            expect(response.map(s => [s.family, s.surplus])).to.deep.equal([
              ['c6', 0],
              ['d5', 0],
              ['i9', 18 + 4 + 2 - 4 - 4],
              ['p7', 8 - 4],
            ])
          })
        })
      })
    })
  })
})
