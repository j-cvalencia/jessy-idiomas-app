import { Navigate, createBrowserRouter } from 'react-router-dom'
import { HomePage } from '@/features/home/HomePage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ActivatePage } from '@/features/auth/ActivatePage'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { TeacherHomePage } from '@/features/teacher/TeacherHomePage'
import { AttendancePage } from '@/features/teacher/AttendancePage'
import { RequireRole } from '@/features/auth/RequireRole'
import { DirectorHomePage } from '@/features/director/DirectorHomePage'
import { StudentsPage } from '@/features/students/StudentsPage'
import { GroupsPage } from '@/features/groups/GroupsPage'
import { GroupsWorkspace } from '@/features/groups/workspace/GroupsWorkspace'
import { PlanningPage } from '@/features/planning/PlanningPage'
import { PaymentsPage } from '@/features/payments/PaymentsPage'
import { Placeholder } from '@/components/ui/Placeholder'
import { DirectorLayout } from './layouts/DirectorLayout'
import { TeacherLayout } from './layouts/TeacherLayout'
import { StudentLayout } from './layouts/StudentLayout'

// Cada Placeholder indica la tarjeta de Trello que lo reemplaza.
export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/activar', element: <ActivatePage /> },
  { path: '/cambiar-clave', element: <ChangePasswordPage /> },
  {
    path: '/director',
    element: (
      <RequireRole roles={['master']}>
        <DirectorLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <DirectorHomePage /> },
      { path: 'estudiantes', element: <StudentsPage /> },
      { path: 'grupos', element: <GroupsWorkspace /> },
      // Pantalla anterior, para comparar mientras se revisa el rediseño.
      { path: 'grupos-anterior', element: <GroupsPage /> },
      { path: 'planificacion', element: <PlanningPage /> },
      { path: 'pagos', element: <PaymentsPage /> },
      { path: 'curriculo', element: <Placeholder title="Currículo A1–C1" card="4.1" /> },
      { path: 'reportes', element: <Placeholder title="Reportes" card="7.2" /> },
    ],
  },
  {
    path: '/profesor',
    element: (
      <RequireRole roles={['teacher']}>
        <TeacherLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <TeacherHomePage /> },
      { path: 'asistencia/:groupId', element: <AttendancePage /> },
    ],
  },
  {
    path: '/estudiante',
    element: (
      <RequireRole roles={['student']}>
        <StudentLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <Placeholder title="Inicio" card="6.3" /> },
      { path: 'progreso', element: <Placeholder title="Mi progreso" card="6.3" /> },
      { path: 'perfil', element: <Placeholder title="Perfil" card="6.3" /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
