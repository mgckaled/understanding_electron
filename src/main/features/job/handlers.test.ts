import * as jobs from '../../jobs'
import { cancelJob } from './handlers'

describe('cancelJob', () => {
  it('aborts the matching job controller', () => {
    const controller = jobs.create('cancel-handler')

    cancelJob({ jobId: 'cancel-handler' })

    expect(controller.signal.aborted).toBe(true)
  })
})
