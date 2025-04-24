import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CreatePaste from './pages/CreatePaste';
import ViewPaste from './pages/ViewPaste';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Secure Pastebin
            </h1>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<CreatePaste />} />
              <Route path="/p/:id" element={<ViewPaste />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
