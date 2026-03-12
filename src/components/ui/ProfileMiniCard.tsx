import { formatRole } from "../../lib/utils";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Avatar } from "./Avatar";
import { MapPin, Briefcase, MessageSquare } from "lucide-react";
import type { User } from "../../types";
import { useTranslation } from "../../hooks/useTranslation";

interface ProfileMiniCardProps {
  user: User;
}

export function ProfileMiniCard({ user }: ProfileMiniCardProps) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col text-center transition-all hover:shadow-[0_0_20px_rgba(79,70,229,0.15)] hover:border-indigo-500/30 group glass-panel h-full">
      <CardHeader className="items-center pb-4">
        <Avatar
          src={user.avatar}
          fallback={user.name.charAt(0)}
          className="mb-4 h-20 w-20 ring-2 ring-transparent group-hover:ring-indigo-500/50 transition-all"
        />
        <CardTitle className="text-lg text-zinc-100 group-hover:text-indigo-400 transition-colors">
          {user.name}
        </CardTitle>
        <p className="text-sm font-medium text-zinc-400">
          {user.title || formatRole(user.role)}
        </p>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-zinc-500">
          {user.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {user.location}
            </div>
          )}
          {user.company && (
            <div className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {user.company}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col items-center">
        <p className="mb-4 line-clamp-2 text-sm text-zinc-400">{user.bio}</p>
        <div className="mb-6 flex flex-wrap justify-center gap-1.5">
          {user.skills?.slice(0, 3).map((skill) => (
            <Badge
              key={skill}
              variant="secondary"
              className="text-[10px] font-normal"
            >
              {skill}
            </Badge>
          ))}
          {user.skills && user.skills.length > 3 && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              +{user.skills.length - 3}
            </Badge>
          )}
        </div>
        <div className="flex w-full gap-2">
          <Link to={`/u/${user.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              {t("common.profile")}
            </Button>
          </Link>
          <Link to={`/messages?to=${user.id}`}>
            <Button variant="default" size="icon">
              <MessageSquare className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
