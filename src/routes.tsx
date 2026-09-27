import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Course } from './pages/Course'
import { ExamSim } from './pages/ExamSim'
import { Library } from './pages/Library'
import { Practice, PracticeIndex } from './pages/Practice'
import { Settings } from './pages/Settings'
import { Shell } from './ui/Shell'

// HashRouter: GitHub Pages serves one index.html and cannot rewrite deep links.
export function AppRoutes() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Library />} />
          <Route path="kurs/:courseId" element={<Course />} />
          <Route path="ova" element={<PracticeIndex />} />
          <Route path="installningar" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        {/* A practice session is full screen, without the navigation (mockups 3–6). */}
        <Route path="ova/:courseId" element={<Practice />} />
        <Route path="kurs/:courseId/tentasimulering" element={<ExamSim />} />
      </Routes>
    </HashRouter>
  )
}
