import SwiftUI

struct WorkItemsView: View {
    @Environment(FirestoreService.self) private var firestoreService
    @Environment(ThemeManager.self) private var theme
    @State private var selectedType = "All"
    @State private var selectedStatus = "All"
    @State private var searchText = ""

    private let typeTabs = ["All", "Change Requests", "Feature Requests", "Maintenance"]
    private let statusTabs = ["All", "Draft", "In Review", "Approved", "Completed"]

    private var filteredItems: [WorkItem] {
        firestoreService.workItems.filter { item in
            matchesType(item) && matchesStatus(item) && matchesSearch(item)
        }
    }

    private func matchesType(_ item: WorkItem) -> Bool {
        switch selectedType {
        case "Change Requests": return item.type == .changeRequest
        case "Feature Requests": return item.type == .featureRequest
        case "Maintenance": return item.type == .maintenance
        default: return true
        }
    }

    private func matchesStatus(_ item: WorkItem) -> Bool {
        switch selectedStatus {
        case "Draft": return item.status == .draft
        case "In Review": return item.status == .inReview
        case "Approved": return item.status == .approved
        case "Completed": return item.status == .completed
        default: return true
        }
    }

    private func matchesSearch(_ item: WorkItem) -> Bool {
        guard !searchText.isEmpty else { return true }
        let query = searchText.lowercased()
        let clientName = firestoreService.clients.first { $0.id == item.clientId }?.name ?? ""
        return item.subject.lowercased().contains(query)
            || clientName.lowercased().contains(query)
            || item.type.displayName.lowercased().contains(query)
    }

    private func clientName(for item: WorkItem) -> String {
        firestoreService.clients.first { $0.id == item.clientId }?.name ?? "Unknown Client"
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

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.96, green: 0.95, blue: 0.98)
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Header
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Work Items")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .padding(.horizontal)

                        // Search bar
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .foregroundStyle(.secondary)

                            TextField("Search work items...", text: $searchText)
                                .textFieldStyle(.plain)
                                .font(.subheadline)
                        }
                        .padding(12)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.white)
                                .shadow(color: .black.opacity(0.04), radius: 4, y: 1)
                        )
                        .padding(.horizontal)

                        // Type filter
                        FilterTabs(tabs: typeTabs, selected: $selectedType)

                        // Status filter
                        FilterTabs(tabs: statusTabs, selected: $selectedStatus)
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 12)

                    // Content
                    if filteredItems.isEmpty {
                        emptyState
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                ForEach(filteredItems) { item in
                                    NavigationLink(value: item) {
                                        workItemCard(item)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal)
                            .padding(.bottom, 24)
                        }
                    }
                }
            }
            .navigationDestination(for: WorkItem.self) { item in
                ChangeOrderReviewView(workItem: item)
            }
        }
    }

    private func workItemCard(_ item: WorkItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.subject)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Text(clientName(for: item))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.quaternary)
            }

            HStack(spacing: 8) {
                // Type tag
                Text(item.type.displayName)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(
                        Capsule()
                            .fill(colorForType(item.type).opacity(0.12))
                    )
                    .foregroundStyle(colorForType(item.type))

                // Status tag
                Text(item.status.displayName)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(
                        Capsule()
                            .fill(colorForStatus(item.status).opacity(0.12))
                    )
                    .foregroundStyle(colorForStatus(item.status))

                Spacer()

                Text(String(format: "%.1f hrs", item.totalHours))
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(formatCurrency(item.totalCost))
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.primary)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
        )
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 56))
                .foregroundStyle(.quaternary)

            Text("No work items found")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            Text("Try adjusting your filters or search query.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: value)) ?? "$\(value)"
    }
}

#Preview {
    WorkItemsView()
}
