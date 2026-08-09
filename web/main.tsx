import "@mantine/core/styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><MantineProvider defaultColorScheme="light"><App /></MantineProvider></React.StrictMode>);
