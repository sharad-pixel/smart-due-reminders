import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface ResponsiveTableProps {
  headers: string[];
  data: Array<{
    id: string;
    cells: ReactNode[];
    onClick?: () => void;
  }>;
  emptyMessage?: string;
}

export const ResponsiveTable = ({ headers, data, emptyMessage = "No data available" }: ResponsiveTableProps) => {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              {headers.map((header, idx) => (
                <th key={idx} className="text-left p-4 font-medium text-muted-foreground text-sm">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr 
                key={row.id} 
                className={`border-b hover:bg-muted/50 transition-colors ${row.onClick ? 'cursor-pointer' : ''}`}
                onClick={row.onClick}
              >
                {row.cells.map((cell, idx) => (
                  <td key={idx} className="p-4">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {data.map((row) => (
          <Card 
            key={row.id} 
            className={row.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
            onClick={row.onClick}
          >
            <CardContent className="p-4 space-y-3">
              {row.cells.map((cell, idx) => (
                <div key={idx} className="flex flex-col space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    {headers[idx]}
                  </span>
                  <div className="text-sm">
                    {cell}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
};
