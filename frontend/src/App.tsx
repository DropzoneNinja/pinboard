import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { AppSettingsProvider } from './contexts/AppSettingsContext';
import { BoardsProvider } from './contexts/BoardsContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { LoginPage } from './components/LoginPage';
import { HomeRedirect } from './boards/HomeRedirect';
import { Whiteboard } from './boards/Whiteboard';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <SocketProvider>
                  <AppSettingsProvider>
                    <BoardsProvider>
                      <AppShell />
                    </BoardsProvider>
                  </AppSettingsProvider>
                </SocketProvider>
              }
            >
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/boards/:boardId" element={<Whiteboard />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
