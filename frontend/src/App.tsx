import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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
                <BoardsProvider>
                  <AppShell />
                </BoardsProvider>
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
