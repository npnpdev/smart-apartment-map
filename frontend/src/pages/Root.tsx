import { Outlet, redirect } from "react-router-dom";
import MainNavigation from "../components/MainNavigation.tsx";

export default function RootLayout() {
  return (
    <>
      <MainNavigation />
      <main>
        {/* {navigation.state === 'loading' && <p>Loading...</p>} */}
        <Outlet />
      </main>
    </>
  );
}

export async function loader()   {
  console.log("Root loader");
}