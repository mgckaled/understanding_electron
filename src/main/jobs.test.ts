import * as jobs from './jobs'

describe('jobs', () => {
  it('create returns a controller whose signal is not aborted', () => {
    const controller = jobs.create('job-create')

    expect(controller.signal.aborted).toBe(false)
  })

  it('cancel aborts the signal of the matching job', () => {
    const controller = jobs.create('job-cancel')

    jobs.cancel('job-cancel')

    expect(controller.signal.aborted).toBe(true)
  })

  it('finish removes the entry so a later cancel has no effect', () => {
    const controller = jobs.create('job-finish')

    jobs.finish('job-finish')
    jobs.cancel('job-finish')

    expect(controller.signal.aborted).toBe(false)
  })
})
