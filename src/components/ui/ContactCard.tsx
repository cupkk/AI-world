import { Link } from "react-router-dom";
import { Card, CardContent } from "./Card";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Mail, MessageSquare, ExternalLink } from "lucide-react";
import type { User } from "../../types";
import { useTranslation } from "../../hooks/useTranslation";
import { normalizeEmailVisibility } from "../../lib/utils";

interface ContactCardProps {
  user: User;
  showEmail?: boolean;
  className?: string;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const masked = local.charAt(0) + "***";
  return `${masked}@${domain}`;
}

export function ContactCard({ user, showEmail = true, className }: ContactCardProps) {
  const { t } = useTranslation();
  const displayEmail = user.contactEmail || user.email;
  const visibility = normalizeEmailVisibility(user.privacySettings?.emailVisibility);

  return (
    <Card className={`glass-panel ${className || ""}`}>
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <span>👋</span> {t("contact.connect")}
        </h3>

        {/* Email */}
        {showEmail && visibility !== "HIDDEN" && displayEmail && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
            <span className="text-zinc-300">
              {visibility === "PUBLIC" ? displayEmail : maskEmail(displayEmail)}
            </span>
          </div>
        )}

        {showEmail && visibility === "HIDDEN" && (
          <p className="text-xs text-zinc-500 italic">{t("contact.email_private")}</p>
        )}

        {/* Social Links */}
        {user.socialLinks && (
          <div className="flex flex-wrap gap-2">
            {user.socialLinks.github && (
              <a href={`https://github.com/${user.socialLinks.github}`} target="_blank" rel="noopener noreferrer">
                <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400 hover:text-zinc-200 cursor-pointer gap-1">
                  <ExternalLink className="h-3 w-3" /> {t("contact.github")}
                </Badge>
              </a>
            )}
            {user.socialLinks.linkedin && (
              <a href={`https://linkedin.com/in/${user.socialLinks.linkedin}`} target="_blank" rel="noopener noreferrer">
                <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400 hover:text-zinc-200 cursor-pointer gap-1">
                  <ExternalLink className="h-3 w-3" /> {t("contact.linkedin")}
                </Badge>
              </a>
            )}
            {user.socialLinks.twitter && (
              <a href={`https://twitter.com/${user.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer">
                <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400 hover:text-zinc-200 cursor-pointer gap-1">
                  <ExternalLink className="h-3 w-3" /> {t("contact.twitter")}
                </Badge>
              </a>
            )}
            {user.socialLinks.website && (
              <a href={user.socialLinks.website} target="_blank" rel="noopener noreferrer">
                <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400 hover:text-zinc-200 cursor-pointer gap-1">
                  <ExternalLink className="h-3 w-3" /> {t("contact.website")}
                </Badge>
              </a>
            )}
          </div>
        )}

        {/* Send Message Button */}
        <Link to={`/messages?to=${user.id}`} className="block">
          <Button className="w-full gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.2)]" size="sm">
            <MessageSquare className="h-4 w-4" />
            {t("contact.send_message")}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
