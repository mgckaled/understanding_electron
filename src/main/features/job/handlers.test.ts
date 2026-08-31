import * as jobs from '../../jobs'
import { cancelJob, listJobs } from './handlers'

describe('cancelJob', () => {
  it('aborts the matching job controller', () => {
    const controller = jobs.create('cancel-handler')

    cancelJob({ jobId: 'cancel-handler' })

    expect(controller.signal.aborted).toBe(true)
  })
})

describe('listJobs', () => {
  it('reports ids of jobs not yet finished', () => {
    jobs.create('list-handler-a')
    jobs.finish('list-handler-a')
    jobs.create('list-handler-b')

    expect(listJobs()).toContain('list-handler-b')
    expect(listJobs()).not.toContain('list-handler-a')
  })
})
