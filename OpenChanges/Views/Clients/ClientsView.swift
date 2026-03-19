import SwiftUI

struct ClientsView: View {
    @Environment(FirestoreService.self) private var firestoreService
    @Environment(ThemeManager.self) private var theme
    @State private var searchText = ""
    @State private var showAddClient = false

    private var filteredClients: [Client] {
        guard !searchText.isEmpty else { return firestoreService.clients }
        let query = searchText.lowercased()
        return firestoreService.clients.filter { client in
            client.name.lowercased().contains(query)
                || client.email.lowercased().contains(query)
                || (client.company?.lowercased().contains(query) ?? false)
        }
    }

    private func initialsFor(_ name: String) -> String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    private let gradientStart = Color(red: 0.486, green: 0.227, blue: 0.929)
    private let gradientEnd = Color(red: 0.659, green: 0.333, blue: 0.969)

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.96, green: 0.95, blue: 0.98)
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Header
                    HStack {
                        Text("Clients")
                            .font(.largeTitle)
                            .fontWeight(.bold)

                        Spacer()

                        Button {
                            showAddClient = true
                        } label: {
                            Image(systemName: "plus")
                                .font(.title3)
                                .fontWeight(.semibold)
                                .foregroundStyle(.white)
                                .frame(width: 36, height: 36)
                                .background(
                                    Circle()
                                        .fill(
                                            LinearGradient(
                                                colors: [gradientStart, gradientEnd],
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            )
                                        )
                                )
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal)
                    .padding(.top, 8)

                    // Search bar
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(.secondary)

                        TextField("Search clients...", text: $searchText)
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
                    .padding(.vertical, 12)

                    // Client list
                    if filteredClients.isEmpty {
                        emptyState
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 8) {
                                ForEach(filteredClients) { client in
                                    NavigationLink(value: client) {
                                        clientRow(client)
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
            .navigationDestination(for: Client.self) { client in
                ClientDetailView(client: client)
            }
            .sheet(isPresented: $showAddClient) {
                AddClientSheet()
            }
        }
    }

    private func clientRow(_ client: Client) -> some View {
        HStack(spacing: 14) {
            // Avatar circle with initials
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [gradientStart.opacity(0.7), gradientEnd.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 44, height: 44)

                Text(initialsFor(client.name))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(client.name)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)

                HStack(spacing: 8) {
                    if let company = client.company, !company.isEmpty {
                        Text(company)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Text(client.email)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.quaternary)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.04), radius: 4, y: 1)
        )
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "person.2")
                .font(.system(size: 56))
                .foregroundStyle(.quaternary)

            Text(searchText.isEmpty ? "No clients yet" : "No clients found")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            Text(searchText.isEmpty
                 ? "Tap + to add your first client."
                 : "Try a different search term.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Add Client Sheet

struct AddClientSheet: View {
    @Environment(FirestoreService.self) private var firestoreService
    @Environment(ThemeManager.self) private var theme
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var company = ""
    @State private var notes = ""
    @State private var isSaving = false

    private let gradientStart = Color(red: 0.486, green: 0.227, blue: 0.929)
    private let gradientEnd = Color(red: 0.659, green: 0.333, blue: 0.969)

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !email.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.96, green: 0.95, blue: 0.98)
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        formSection(title: "Details") {
                            formField(label: "Name", placeholder: "Full name", text: $name)
                            Divider().padding(.horizontal)
                            formField(label: "Email", placeholder: "email@example.com", text: $email)
                                #if os(iOS)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                #endif
                            Divider().padding(.horizontal)
                            formField(label: "Phone", placeholder: "Optional", text: $phone)
                                #if os(iOS)
                                .keyboardType(.phonePad)
                                #endif
                            Divider().padding(.horizontal)
                            formField(label: "Company", placeholder: "Optional", text: $company)
                        }

                        formSection(title: "Notes") {
                            TextField("Notes about this client...", text: $notes, axis: .vertical)
                                .font(.subheadline)
                                .lineLimit(3...6)
                                .padding(14)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("New Client")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await saveClient() }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Save")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(!isValid || isSaving)
                }
            }
        }
    }

    private func formSection(title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title.uppercased())
                .font(.caption)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 4)
                .padding(.bottom, 6)

            VStack(spacing: 0) {
                content()
            }
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color.white)
            )
        }
    }

    private func formField(label: String, placeholder: String, text: Binding<String>) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(width: 80, alignment: .leading)

            TextField(placeholder, text: text)
                .font(.subheadline)
                .textFieldStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private func saveClient() async {
        isSaving = true
        let client = Client(
            name: name.trimmingCharacters(in: .whitespaces),
            email: email.trimmingCharacters(in: .whitespaces),
            phone: phone.isEmpty ? nil : phone,
            company: company.isEmpty ? nil : company,
            notes: notes.isEmpty ? nil : notes
        )
        do {
            try await firestoreService.createClient(client)
            dismiss()
        } catch {
            print("Error creating client: \(error.localizedDescription)")
        }
        isSaving = false
    }
}

#Preview {
    ClientsView()
}
