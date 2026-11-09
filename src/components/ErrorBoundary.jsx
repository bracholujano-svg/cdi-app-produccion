import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isDev = Boolean(import.meta?.env?.DEV);
      return (
        <div style={{ padding: '24px', background: '#7f1d1d', color: 'white', zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>⚠️ Ocurrió un problema inesperado en la interfaz</h2>
          <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '16px' }}>
            Por seguridad, los detalles técnicos internos se han ocultado. Puedes recargar la aplicación sin perder los datos sincronizados en planta.
          </p>
          {isDev && (
            <details style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontSize: '12px' }}>
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </details>
          )}
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '12px 20px', background: 'white', color: '#7f1d1d', fontWeight: 'bold', border: 'none', cursor: 'pointer', borderRadius: '10px' }}>
            Recargar Aplicación
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}
