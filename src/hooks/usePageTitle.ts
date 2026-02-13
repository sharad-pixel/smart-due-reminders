import { useEffect } from "react";

export const usePageTitle = (title: string) => {
  useEffect(() => {
    document.title = title.includes("Recouply") ? title : `${title} | Recouply.ai`;
  }, [title]);
};
