/**
 * [INPUT]: open, onClose, profile, onSave
 * [OUTPUT]: ProfileDialog component
 * [POS]: 用户个人资料编辑对话框
 * [PROTOCOL]: 变更时更新此头部
 */

import { useState, useEffect, useRef } from "react";
import { PersonIcon } from "@radix-ui/react-icons";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import type { UserProfile } from "../../types";

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
}

export function ProfileDialog({
  open,
  onClose,
  profile,
  onSave,
}: ProfileDialogProps) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setNickname(profile.nickname);
      setAvatarUrl(profile.avatarUrl);
    }
  }, [open, profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setAvatarUrl(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSave({ nickname, avatarUrl });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className="h-20 w-20">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={nickname || "User"} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {nickname ? (
                    nickname.charAt(0).toUpperCase()
                  ) : (
                    <PersonIcon className="w-8 h-8" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs">Upload</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">Click avatar to upload</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your nickname"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
