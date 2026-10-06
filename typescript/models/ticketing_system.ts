type Status = "open" | "in_progress" | "resolved" | "closed";
type Priority = "low" | "medium" | "high" | "urgent";

interface Ticket{
    readonly id: number,
    status: Status,
    assignee?: number,
    priority: Priority,
    tags: string[],
    title: string,
    description?: string,
    createdAt: Date,
    resolvedAt?: Date
};

interface User{
    name: string,
    id: number,
    email: string
}

type UpdateTicketInput = Omit<Partial<Ticket>, 'id'|'resolvedAt'>;
type CreateTicketInput = Omit<Ticket, 'id' | 'createdAt' | 'status' | 'resolvedAt'>;
type TicketFilters = Pick<Partial<Ticket>, 'status'|'assignee'|'priority' > 

class TicketSystem {
    private ticketId: number = 0;
    private tickets = new Map<number, Ticket>();

    private getTicketOrThrow(id: number): Ticket {
        const ticket = this.tickets.get(id);
        if (ticket === undefined) {
            throw new Error(`Ticket ${id} not found`);
        }
        return ticket;
    }

    createTicket(input: CreateTicketInput): Ticket{
        const newTicket: Ticket = {
            ...input,
            id: this.ticketId,
            status: "open",
            createdAt: new Date(),
        }
        this.tickets.set(this.ticketId, newTicket);
        this.ticketId++;
        return newTicket;
    }
    updateTicket(id: number, changes: UpdateTicketInput): Ticket{
        const ticket: Ticket = this.getTicketOrThrow(id);
        const newTicket: Ticket = { ...ticket, ...changes, id };
        if (changes.status === 'resolved' && ticket.status !== 'resolved') {
            newTicket.resolvedAt = new Date();
        }
        if (changes.status !== 'resolved' && ticket.status === 'resolved') {
            newTicket.resolvedAt = undefined;
        }
        this.tickets.set(id, newTicket);
        return newTicket;
    }

    assignTicket(id: number, user: User): Ticket{
        return this.updateTicket(id, { assignee: user.id });
    }

    findTickets(filters: TicketFilters): Ticket[]{
        const tickets = Array.from(this.tickets.values());
        return tickets.filter((t) => {
            if (filters.status !== undefined && t.status !== filters.status) {
                return false;
            }
            if (filters.priority !== undefined && t.priority !== filters.priority) {
                return false;
            }
            if (filters.assignee !== undefined && t.assignee !== filters.assignee) {
                return false;
            }
            return true; 
        })
    }
}