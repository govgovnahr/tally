import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        fontFamily: 'inherit',
      }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>Something went wrong.</p>
        <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Refresh the page to try again.</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            padding: '8px 20px',
            borderRadius: 8,
            border: '1px solid #ddd',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Refresh
        </button>
      </div>
    )
  }
}
