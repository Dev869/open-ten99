import SwiftUI

struct ClientDetailView: View {
    let client: Client
    @Environment(FirestoreService.self) private var firestoreService
    @Environment(ThemeManager.self) private var theme
    @State private var isEditing = false
    @State private var editedName: String = ""
    @State private var editedEmail: String = ""
    @State private var editedPhone: String = ""
    @State private var editedCompany: String = ""
    @State private var editedNotes: String = ""

    private let gradientStart = Color(red: 0.486, green: 0.227, blue: 0.929)
    private let gradientEnd = Color(red: 0.659, green: 0.333, blue: 0.969)

    private var clientWorkItems: [WorkItem] {
        firestoreService.workItems.filter { $0.clientId == client.id }
    }

    private var totalProjects: Int {
        clientWorkItems.count
    }

    private var totalHours: Double {
        clientWorkItems.reduce(0) { $0 + $1.totalHours }
    }

    private var totalRevenue: Double {
        clientWorkItems.reduce(0) { $0 + $1.totalCost }
    }

    private func initialsFor(_ name: String) -> String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    var body: some View {
        ZStack {
            Color(red: 0.96, green: 0.95, blue: 0.98)
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 16) {
                    clientHeader
                    statsRow
                    workHistorySection
                }
                .padding()
            }
        }
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(isEditing ? "Done" : "Edit") {
                    if isEditing {
                        // Save would go here — for now just toggle
                        isEditing = false
                    } else {
                        startEditing()
                    }
                }
                .fontWeight(.medium)
            }
        }
    }

    // MARK: - Client Header

    private var clientHeader: some View {
        VStack(spacing: 16) {
            // Avatar
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [gradientStart, gradientEnd],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 72, height: 72)

                Text(initialsFor(client.name))
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
            }

            if isEditing {
                editableFields
            } else {
                readOnlyFields
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
        )
    }

    private var readOnlyFields: some View {
        VStack(spacing: 6) {
            Text(client.name)
                .font(.title2)
                .fontWeight(.bold)

            if let company = client.company, !company.isEmpty {
                Text(company)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Divider()
                .padding(.vertical, 4)

            HStack(spacing: 20) {
                Label(client.email, systemImage: "envelope.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let phone = client.phone, !phone.isEmpty {
                    Label(phone, systemImage: "phone.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if let notes = client.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)
            }
        }
    }

    private var editableFields: some View {
        VStack(spacing: 10) {
            editField(label: "Name", text: $editedName)
            editField(label: "Email", text: $editedEmail)
            editField(label: "Phone", text: $editedPhone, placeholder: "Optional")
            editField(label: "Company", text: $editedCompany, placeholder: "Optional")
            editField(label: "Notes", text: $editedNotes, placeholder: "Optional")
        }
    }

    private func editField(label: String, text: Binding<String>, placeholder: String = "") -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 70, alignment: .trailing)

            TextField(placeholder.isEmpty ? label : placeholder, text: text)
                .font(.subheadline)
                .textFieldStyle(.plain)
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(red: 0.96, green: 0.95, blue: 0.98))
                )
        }
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: 12) {
            statCard(title: "Projects", value: "\(totalProjects)", icon: "doc.text.fill")
            statCard(title: "Hours", value: String(format: "%.0f", totalHours), icon: "clock.fill")
            statCard(title: "Revenue", value: formatCurrency(totalRevenue), icon: "dollarsign.circle.fill")
        }
    }

    private func statCard(title: String, value: String, icon: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(theme.accentColor)

            Text(value)
                .font(.headline)
                .fontWeight(.bold)

            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.04), radius: 4, y: 1)
        )
    }

    // MARK: - Work History

    private var workHistorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Work History")
                .font(.headline)
                .padding(.horizontal, 4)

            if clientWorkItems.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 28))
                        .foregroundStyle(.quaternary)

                    Text("No work items yet")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(Color.white)
                        .shadow(color: .black.opacity(0.04), radius: 4, y: 1)
                )
            } else {
                ForEach(clientWorkItems.sorted(by: { $0.createdAt > $1.createdAt })) { item in
                    workHistoryRow(item)
                }
            }
        }
    }

    private func workHistoryRow(_ item: WorkItem) -> some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 3)
                .fill(colorForType(item.type))
                .frame(width: 4, height: 40)

            VStack(alignment: .leading, spacing: 3) {
                Text(item.subject)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    Text(item.type.displayName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    Text(item.createdAt.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(formatCurrency(item.totalCost))
                    .font(.caption)
                    .fontWeight(.semibold)

                Text(item.status.displayName)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(colorForStatus(item.status).opacity(0.12))
                    )
                    .foregroundStyle(colorForStatus(item.status))
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.04), radius: 4, y: 1)
        )
    }

    // MARK: - Helpers

    private func startEditing() {
        editedName = client.name
        editedEmail = client.email
        editedPhone = client.phone ?? ""
        editedCompany = client.company ?? ""
        editedNotes = client.notes ?? ""
        isEditing = true
    }

    private func colorForType(_ type: WorkItem.WorkItemType) -> Color {
        switch type {
        case .changeRequest: return Color(red: 0.486, green: 0.227, blue: 0.929)
        case .featureRequest: return Color.green
        case .maintenance: return Color.orange
        }
    }

    private func colorForStatus(_ status: WorkItem.Status) -> Color {
        switch status {
        case .draft: return .orange
        case .inReview: return Color(red: 0.486, green: 0.227, blue: 0.929)
        case .approved: return .green
        case .completed: return .gray
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$\(value)"
    }
}

#Preview {
    NavigationStack {
        ClientDetailView(client: Client(
            id: "1",
            name: "Jane Smith",
            email: "jane@acmecorp.com",
            phone: "+1 555 123 4567",
            company: "Acme Corp",
            notes: "Prefers email communication"
        ))
    }
}
