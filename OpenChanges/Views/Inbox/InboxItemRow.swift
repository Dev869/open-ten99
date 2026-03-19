import SwiftUI

struct InboxItemRow: View {
    let workItem: WorkItem
    let clientName: String
    var onReview: () -> Void = {}
    @Environment(ThemeManager.self) private var theme

    private var typeColor: Color {
        switch workItem.type {
        case .changeRequest: return Color(red: 0.486, green: 0.227, blue: 0.929) // purple
        case .featureRequest: return Color.green
        case .maintenance: return Color.orange
        }
    }

    private var statusLabel: String {
        switch workItem.status {
        case .draft: return "Pending"
        case .inReview: return "In Review"
        case .approved: return "Approved"
        case .completed: return "Completed"
        }
    }

    private var statusColor: Color {
        switch workItem.status {
        case .draft: return Color.orange
        case .inReview: return Color(red: 0.486, green: 0.227, blue: 0.929)
        case .approved: return Color.green
        case .completed: return Color.gray
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Colored type dot
            Circle()
                .fill(typeColor)
                .frame(width: 10, height: 10)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 6) {
                // Title
                Text("\(clientName) — \(workItem.subject)")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)
                    .lineLimit(2)

                // Meta line
                HStack(spacing: 12) {
                    Label(
                        String(format: "%.1f hrs", workItem.totalHours),
                        systemImage: "clock"
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)

                    Label(
                        formatCurrency(workItem.totalCost),
                        systemImage: "dollarsign.circle"
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)

                    Text(workItem.type.displayName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 8) {
                // Status pill
                Text(statusLabel)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(statusColor.opacity(0.15))
                    )
                    .foregroundStyle(statusColor)

                // Review button
                Button(action: onReview) {
                    Text("Review \(Image(systemName: "arrow.right"))")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(theme.accentColor)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
        )
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: value)) ?? "$\(value)"
    }
}

#Preview {
    InboxItemRow(
        workItem: WorkItem(
            type: .changeRequest,
            status: .draft,
            clientId: "1",
            sourceEmail: "client@example.com",
            subject: "Update homepage hero section",
            lineItems: [
                LineItem(description: "Design update", hours: 2, cost: 200),
                LineItem(description: "Implementation", hours: 4, cost: 400)
            ],
            totalHours: 6,
            totalCost: 600
        ),
        clientName: "Acme Corp"
    )
    .padding()
    .background(Color(white: 0.95))
}
