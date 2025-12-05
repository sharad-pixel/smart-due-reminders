import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Save, 
  ChevronDown, 
  Check, 
  Star, 
  Trash2, 
  RefreshCw,
  Bookmark
} from 'lucide-react';
import { SavedView, ViewConfig } from '@/hooks/useSavedViews';

interface SavedViewsManagerProps {
  savedViews: SavedView[];
  activeView: SavedView | null;
  currentConfig: ViewConfig;
  onSave: (name: string, config: ViewConfig, setAsDefault: boolean) => Promise<SavedView | null>;
  onUpdate: (viewId: string, config: ViewConfig) => Promise<void>;
  onDelete: (viewId: string) => Promise<void>;
  onSetDefault: (viewId: string) => Promise<void>;
  onLoad: (view: SavedView) => void;
  onClear: () => void;
}

export function SavedViewsManager({
  savedViews,
  activeView,
  currentConfig,
  onSave,
  onUpdate,
  onDelete,
  onSetDefault,
  onLoad,
  onClear
}: SavedViewsManagerProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!newViewName.trim()) return;
    
    setIsSaving(true);
    const result = await onSave(newViewName.trim(), currentConfig, setAsDefault);
    setIsSaving(false);
    
    if (result) {
      setSaveDialogOpen(false);
      setNewViewName('');
      setSetAsDefault(false);
    }
  };

  const handleUpdateCurrent = async () => {
    if (activeView) {
      await onUpdate(activeView.id, currentConfig);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Bookmark className="h-4 w-4" />
              {activeView ? activeView.name : 'Saved Views'}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {savedViews.length > 0 ? (
              <>
                {savedViews.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    onClick={() => onLoad(view)}
                    className="flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      {view.is_default && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                      {view.name}
                    </span>
                    {activeView?.id === view.id && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            ) : (
              <DropdownMenuItem disabled>No saved views</DropdownMenuItem>
            )}
            
            {activeView && (
              <>
                <DropdownMenuItem onClick={handleUpdateCurrent}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Update "{activeView.name}"
                </DropdownMenuItem>
                {!activeView.is_default && (
                  <DropdownMenuItem onClick={() => onSetDefault(activeView.id)}>
                    <Star className="h-4 w-4 mr-2" />
                    Set as Default
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => onDelete(activeView.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete View
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onClear}>
                  Clear Active View
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            
            <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
              <Save className="h-4 w-4 mr-2" />
              Save New View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="My custom view"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="set-default"
                checked={setAsDefault}
                onCheckedChange={(checked) => setSetAsDefault(checked === true)}
              />
              <Label htmlFor="set-default" className="text-sm">
                Set as default view for this page
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!newViewName.trim() || isSaving}>
              {isSaving ? 'Saving...' : 'Save View'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
