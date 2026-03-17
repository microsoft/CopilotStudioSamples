export interface IChatbotProps {
     botURL: string;
     buttonLabel?: string;
     botName?: string;
     userEmail: string;
     userFriendlyName: string;
     botAvatarImage?: string;
     botAvatarInitials?: string;
     greet?: boolean;
     customScope: string;
     clientID: string;
     authority: string;
}