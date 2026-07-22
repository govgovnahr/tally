import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import MfaSetupDialog from './MfaSetupDialog.jsx'

const mockEnroll = vi.fn()
const mockChallengeAndVerify = vi.fn()
const mockUnenroll = vi.fn()

vi.mock('../../supabase.js', () => ({
  supabase: {
    auth: {
      mfa: {
        enroll: (...args) => mockEnroll(...args),
        challengeAndVerify: (...args) => mockChallengeAndVerify(...args),
        unenroll: (...args) => mockUnenroll(...args),
      },
    },
  },
}))

const FACTOR = {
  id: 'factor-1',
  totp: { qr_code: 'data:image/svg+xml;base64,AAAA', secret: 'ABCD EFGH IJKL' },
}

beforeEach(() => {
  mockEnroll.mockReset()
  mockChallengeAndVerify.mockReset()
  mockUnenroll.mockReset()
  mockEnroll.mockResolvedValue({ data: FACTOR, error: null })
  mockUnenroll.mockResolvedValue({ data: {}, error: null })
})

describe('MfaSetupDialog', () => {
  it('enrolls a factor on open and shows the QR code and manual secret', async () => {
    render(<MfaSetupDialog open onOpenChange={() => {}} onEnrolled={() => {}} />)

    await waitFor(() => expect(mockEnroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Authenticator app' }))
    expect(await screen.findByAltText(/scan this qr code/i)).toBeInTheDocument()
    expect(screen.getByText('ABCD EFGH IJKL')).toBeInTheDocument()
  })

  it('shows setup instructions for iOS, Android, and desktop', async () => {
    render(<MfaSetupDialog open onOpenChange={() => {}} onEnrolled={() => {}} />)

    expect(await screen.findByText('iPhone/iPad')).toBeInTheDocument()
    expect(screen.getByText('Android')).toBeInTheDocument()
    expect(screen.getByText(/desktop/i)).toBeInTheDocument()
  })

  it('verifies the entered code and calls onEnrolled on success', async () => {
    mockChallengeAndVerify.mockResolvedValue({ data: {}, error: null })
    const onEnrolled = vi.fn()
    render(<MfaSetupDialog open onOpenChange={() => {}} onEnrolled={onEnrolled} />)

    await screen.findByAltText(/scan this qr code/i)
    fireEvent.change(screen.getByLabelText(/enter the 6-digit code/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /verify & enable/i }))

    await waitFor(() => expect(mockChallengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' }))
    await waitFor(() => expect(onEnrolled).toHaveBeenCalled())
  })

  it('shows an error and does not call onEnrolled when verification fails', async () => {
    mockChallengeAndVerify.mockResolvedValue({ data: null, error: { message: 'Invalid code' } })
    const onEnrolled = vi.fn()
    render(<MfaSetupDialog open onOpenChange={() => {}} onEnrolled={onEnrolled} />)

    await screen.findByAltText(/scan this qr code/i)
    fireEvent.change(screen.getByLabelText(/enter the 6-digit code/i), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: /verify & enable/i }))

    expect(await screen.findByText('Invalid code')).toBeInTheDocument()
    expect(onEnrolled).not.toHaveBeenCalled()
  })

  it('unenrolls the unverified factor when the user cancels', async () => {
    const onOpenChange = vi.fn()
    render(<MfaSetupDialog open onOpenChange={onOpenChange} onEnrolled={() => {}} />)

    await screen.findByAltText(/scan this qr code/i)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => expect(mockUnenroll).toHaveBeenCalledWith({ factorId: 'factor-1' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows an error if enrollment itself fails', async () => {
    mockEnroll.mockResolvedValue({ data: null, error: { message: 'Enrollment failed' } })
    render(<MfaSetupDialog open onOpenChange={() => {}} onEnrolled={() => {}} />)

    expect(await screen.findByText('Enrollment failed')).toBeInTheDocument()
  })
})
