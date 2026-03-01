import GdanskMap from "./components/Map/Map.tsx";

import RootLayout, { loader as rootLoader } from "./pages/Root";
import {createBrowserRouter, createHashRouter, RouterProvider} from "react-router-dom";
import MainNavigation from "./components/MainNavigation.tsx";
import ErrorPage from "./pages/ErrorPage.tsx";
import HomePage from "./pages/HomePage.tsx";
import Map from "./components/Map/Map.tsx";
import Authentication from "./pages/Authentication.tsx";
import LoginPage from "./pages/LoginPage.tsx";

//const router = createHashRouter([
const router = createBrowserRouter([
  {
    id: "root",
    path: "/",
    loader: rootLoader,
    element: <RootLayout />,
    errorElement: (
      <>
        <MainNavigation />
        <ErrorPage />
      </>
    ),
    children: [
      { index: true, element: <HomePage /> },
      {
        id: "map",
        path: "map",
        element: <Map />,
      },
      {
        path: "login",
        element: <LoginPage />,
    //
      },
      { path: "*", element: <ErrorPage /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
