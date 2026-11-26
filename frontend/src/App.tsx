import { useEffect, useState } from 'react';

type HealthStatus = 'checking' | 'ok' | 'error';

function App() {
  const [status, setStatus] = useState<HealthStatus>('checking');

  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => (res.ok ? setStatus('ok') : setStatus('error')))
      .catch(() => setStatus('error'));
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Household Whiteboard</h1>
      <p>Scaffold placeholder — the real whiteboard UI lands in later phases.</p>
      <p>Backend health check: {status}</p>
    </main>
  );
}

export default App;
