import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SimPage   from './pages/SimPage.jsx';
import LearnPage from './pages/LearnPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<SimPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/learn/:lessonId" element={<LearnPage />} />
      </Routes>
    </BrowserRouter>
  );
}
