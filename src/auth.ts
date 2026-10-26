import NextAuth, { type DefaultSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./lib/prisma"
import bcrypt from "bcryptjs"

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: string;
        } & DefaultSession["user"]
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) return null;

                let user = await prisma.user.findUnique({
                    where: { username: credentials.username as string }
                });

                if (!user) {
                    const allUsers = await prisma.user.findMany();
                    user = allUsers.find((u: any) => u.username.toLowerCase() === (credentials.username as string).toLowerCase()) || null;
                }

                if (!user) return null;

                const isPasswordValid = await bcrypt.compare(credentials.password as string, user.password);
                if (!isPasswordValid) return null;

                return {
                    id: user.id,
                    name: user.username,
                    role: user.role
                };
            },
        }),
    ],
    callbacks: {
        jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
                token.id = user.id;
                token.name = user.name;
            }
            return token;
        },
        session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as string;
                session.user.id = token.id as string;
                if (token.name) {
                    session.user.name = token.name as string;
                }
            }
            return session;
        }
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
    // Trỏ NextAuth về sử dụng adapter và cấu hình để tránh gọi DB Edge
    trustHost: true,
})
