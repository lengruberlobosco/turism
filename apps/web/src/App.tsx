import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { TripsPage } from "./pages/TripsPage";
import { NewTripPage } from "./pages/NewTripPage";
import { ImportPage } from "./pages/ImportPage";
import { TripLayout } from "./pages/TripLayout";
import { DayPage } from "./pages/DayPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ShareTargetPage } from "./pages/ShareTargetPage";
import { SuggestionsPage } from "./pages/SuggestionsPage";
import { MorePage } from "./pages/MorePage";
import { TravelersPage } from "./pages/TravelersPage";
import { ChecklistsPage } from "./pages/ChecklistsPage";
import { EmergencyPage } from "./pages/EmergencyPage";
import { BookPage } from "./pages/BookPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
    children: [
      { index: true, element: <TripsPage /> },
      { path: "trips/new", element: <NewTripPage /> },
      { path: "import", element: <ImportPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "share-target", element: <ShareTargetPage /> },
      {
        path: "trips/:tripId",
        element: <TripLayout />,
        children: [
          { index: true, element: <Navigate to="days/current" replace /> },
          { path: "days/:dayRef", element: <DayPage /> },
          { path: "documents", element: <DocumentsPage /> },
          { path: "expenses", element: <ExpensesPage /> },
          { path: "suggestions", element: <SuggestionsPage /> },
          { path: "import", element: <ImportPage /> },
          { path: "more", element: <MorePage /> },
          { path: "travelers", element: <TravelersPage /> },
          { path: "checklists", element: <ChecklistsPage /> },
          { path: "emergency", element: <EmergencyPage /> },
          { path: "book", element: <BookPage /> },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
