import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorId: null };
    }

    static getDerivedStateFromError(error) {
        const errorId = Math.random().toString(36).slice(2, 8).toUpperCase();
        return { hasError: true, error, errorId };
    }

    componentDidCatch(err, info) {
        const errorId = Math.random().toString(36).slice(2, 8).toUpperCase();
        this.setState({ errorId });
        console.error(`[${errorId}] ErrorBoundary:`, err, info);
    }

    render() {
        if (this.state.hasError) return (
            <div className="h-screen flex flex-col items-center justify-center bg-[var(--bg-main)] gap-3">
                <p className="text-[var(--text-main)] font-semibold text-lg">Qualcosa è andato storto</p>
                <p className="text-[var(--text-muted)] text-sm max-w-sm text-center">{this.state.error?.message}</p>
                <p className="text-[var(--text-muted)] text-xs">Codice errore: <span className="font-mono font-semibold">{this.state.errorId}</span></p>
                <button
                    onClick={() => this.setState({ hasError: false, error: null, errorId: null })}
                    className="mt-2 px-6 py-2 rounded-xl bg-[var(--accent)] text-white font-semibold text-xs">
                    Riprova
                </button>
            </div>
        );
        return this.props.children;
    }
}

export default ErrorBoundary;