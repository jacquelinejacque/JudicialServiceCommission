<script>
import { Const } from '../../utils/constants'
import Toastify from 'toastify-js'
import AssignTicketForm from './AssignTicketForm.vue'
import { Modal } from 'bootstrap'

export default {
  data() {
    return {
      loading: false,
      notesLoading: false,
      ticket: null,
      ticketNotes: [],
      selectedTicket: null,
      actionMode: null,
      currentUser: JSON.parse(localStorage.getItem('user') || '{}')
    }
  },

  computed: {
    ticketID() {
      return this.$route.params.ticketID
    },

    isAdmin() {
      return this.currentUser?.role === 'admin'
    },

    isAssignedAgent() {
      return this.ticket?.assignedTo === this.currentUser?.userID
    },

    canAssignTicket() {
      return this.isAdmin && this.ticket?.status === 'new'
    },

    canReassignTicket() {
      return this.isAdmin && this.ticket?.status === 'open'
    },

    canEscalateTicket() {
      const allowedStatuses = ['open', 'new'] 
      return this.isAdmin && allowedStatuses.includes(this.ticket?.status)
    },

    canAddNotes() {
      const allowedStatuses = ['open', 'escalated']

      return (
        allowedStatuses.includes(this.ticket?.status) &&
        (this.isAdmin || this.isAssignedAgent)
      )
    },

    canResolveTicket() {
      return (
        this.ticket?.status === 'open' &&
        (this.isAdmin || this.isAssignedAgent)
      )
    },

    canCloseTicket() {
      return this.isAdmin && this.ticket?.status === 'resolved'
    },

    ticketTimeline() {
      const notes = this.ticketNotes.map(n => ({
        type: 'note',
        data: n,
        time: new Date(n.createdAt)
      }))

      if (this.ticket?.status === 'escalated') {
        notes.push({
          type: 'escalation',
          data: {
            user: this.ticket.escalator || {
              name: this.ticket.escalatedByName || 'Unknown',
              role: 'Admin'
            },
            escalationReason: this.ticket.escalationReason,
            escalatedToTeam: this.ticket.escalatedToTeam,
            escalatedBy: this.ticket.escalatedBy,
            assignedTo: this.ticket.agent,
            escalatedAt: this.ticket.escalatedAt
          },
          time: new Date(this.ticket.escalatedAt)
        })
      }

      return notes.sort((a, b) => a.time - b.time)
    }
  },
  mounted() {
    this.loadTicketDetails()
  },
  components: {
    AssignTicketForm
  },

  methods: {
    showToast(message, isDanger = false) {
      Toastify({
        text: message,
        style: {
          background: isDanger ? '#d63939' : '#2fb344'
        }
      }).showToast()
    },

    async loadTicketDetails() {
      this.loading = true
      this.notesLoading = true

      try {
        const [ticketResponse, notesResponse] = await Promise.all([
          fetch(`${Const.BASE_URL}/helpDesk/${this.ticketID}`, {
            headers: { 'access-token': localStorage.getItem('accessToken') }
          }),
          fetch(`${Const.BASE_URL}/ticketNotes/list/${this.ticketID}`, {
            headers: { 'access-token': localStorage.getItem('accessToken') }
          })
        ])

        const ticketResult = await ticketResponse.json()
        const notesResult = await notesResponse.json()

        this.ticket = ticketResult.ticket || {}

        this.ticketNotes = Array.isArray(notesResult.notes)
          ? notesResult.notes.filter(n => n?.note)
          : []

        // 🔥 force UI refresh safety
        this.$forceUpdate()

      } catch (err) {
        this.showToast(err.message, true)
      } finally {
        this.loading = false
        this.notesLoading = false
      }
    },

    getAttachmentUrl(path) {
      if (!path) return null
      if (path.startsWith('http://') || path.startsWith('https://')) return path
      return `${Const.BASE_URL}/${path}`
    },

    getFileName(path) {
      if (!path) return ''
      return path.split('/').pop()
    },

    getAuthorRole(note) {
      const role = note.author?.role
      if (role === 'admin') return 'Admin'
      if (role === 'agent') return 'Agent'
      return 'Support'
    },

    openAssignModal(ticket, mode) {
      this.selectedTicket = ticket
      this.actionMode = mode

      const modalEl = document.getElementById('assignTicketModal')
      const modal = new Modal(modalEl)
      modal.show()
    },

    cleanupModal(modalId) {
      const modalEl = document.getElementById(modalId)
      if (!modalEl) return

      const modalInstance = Modal.getInstance(modalEl)
      if (modalInstance) {
        modalInstance.hide()
      }

      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove())
      document.body.classList.remove('modal-open')
      document.body.style.removeProperty('padding-right')
    },

    handleTicketAssigning() {
      this.cleanupModal('assignTicketModal')

      this.selectedTicket = null
      this.actionMode = null

      // force full refresh of ticket state
      this.loadTicketDetails()
    }
  }
}
</script>

<template>
  <div class="container-xxl py-3">
    <div class="card-header bg-white d-flex align-items-center justify-content-between gap-3 py-3">
      <div class="d-flex align-items-center gap-3">
        <button
          class="btn btn-outline-secondary btn-sm d-flex align-items-center"
          @click="$router.back()"
        >
          <i class="bi bi-arrow-left"></i>
        </button>

        <div>
          <h4 class="mb-1">Ticket Details</h4>
          <small class="text-muted">View ticket guidance, notes and attachments.</small>
        </div>
      </div>

      <div v-if="ticket" class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
        <button
          v-if="canAssignTicket"
          class="btn btn-primary btn-sm"
          @click="openAssignModal(ticket, 'assign')"
        >
          Assign Ticket
        </button>

        <button
          v-if="canReassignTicket"
          class="btn btn-warning btn-sm"
          @click="openAssignModal(ticket, 'reassign')"
        >
          Reassign Ticket
        </button>

        <button
          v-if="canEscalateTicket"
          class="btn btn-danger btn-sm"
          @click="openAssignModal(ticket, 'escalate')"
        >
          Escalate Ticket
        </button>

        <button
          v-if="canAddNotes"
          class="btn btn-info btn-sm text-white"
          @click="openAssignModal(ticket, 'notes')"
        >
          Add Notes
        </button>

        <button
          v-if="canResolveTicket"
          class="btn btn-success btn-sm"
          @click="openAssignModal(ticket, 'resolve')"
        >
          Resolve Ticket
        </button>

        <button
          v-if="canCloseTicket"
          class="btn btn-dark btn-sm"
          @click="openAssignModal(ticket, 'close')"
        >
          Close Ticket
        </button>
      </div>
    </div>

    <div v-if="loading" class="card shadow-sm">
      <div class="card-body text-muted">
        Loading ticket details...
      </div>
    </div>

    <template v-else-if="ticket">
      <div class="card shadow-sm mb-4">
        <div class="card-header">
          <h5 class="mb-0">Ticket {{ ticket.ticketNumber }}</h5>
          <small class="text-muted">{{ ticket.title }}</small>
        </div>

        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <div class="border rounded p-3 h-100">
                <h6 class="mb-3">Ticket Details</h6>
                <p class="mb-2"><strong>Requester:</strong> {{ ticket.requester?.name || ticket.createdBy || '_' }}</p>
                <p class="mb-2"><strong>Email:</strong> {{ ticket.requester?.email || '_' }}</p>
                <p class="mb-2"><strong>Phone:</strong> {{ ticket.requester?.phone || '_' }}</p>
                <p class="mb-2"><strong>Issue Type:</strong> {{ ticket.issueType || '_' }}</p>
                <p class="mb-2"><strong>Status:</strong> {{ ticket.status || '_' }}</p>
                <p class="mb-2"><strong>Priority:</strong> {{ ticket.priority || '_' }}</p>
                <p class="mb-0"><strong>Assigned To:</strong> {{ ticket.agent?.name || '_' }}</p>
              </div>
            </div>

            <div class="col-md-6">
              <div class="border rounded p-3 h-100">
                <h6 class="mb-3">Problem Description</h6>
                <p class="mb-0">{{ ticket.description || 'No description provided.' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-header">
          <h5 class="mb-0">Guidance / Notes</h5>
        </div>

        <div class="card-body">

          <div v-if="notesLoading" class="text-muted">
            Loading notes...
          </div>

          <div v-else-if="ticketTimeline.filter(i => i.type === 'note').length === 0" class="text-muted">
            No notes have been added to this ticket yet.
          </div>

          <div v-else class="d-flex flex-column gap-3">

            <div
              v-for="item in ticketTimeline"
              :key="item.time"
            >

              <!-- NORMAL NOTE -->
              <div
                v-if="item.type === 'note'"
                class="border rounded p-3 bg-light"
              >
                <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                  <div>
                    <strong>{{ item.data.author?.name || 'Support' }}</strong>
                    <span class="badge bg-success text-white ms-2">
                      {{ getAuthorRole(item.data) }}
                    </span>
                  </div>

                  <small class="text-muted">
                    {{ new Date(item.time).toLocaleString() }}
                  </small>
                </div>

                <p class="mb-2">{{ item.data.note || '_' }}</p>

                <div v-if="item.data.attachment || item.data.attachmentUrl">
                  <a
                    :href="item.data.attachmentUrl || getAttachmentUrl(item.data.attachment)"
                    target="_blank"
                    class="btn btn-sm btn-outline-secondary"
                  >
                    View Attachment
                  </a>
                </div>
              </div>

<div
  v-else-if="item.type === 'escalation'"
  class="border rounded p-3 bg-light"
>
  <!-- Escalation Header -->
  <div class="d-flex justify-content-between mb-2">
    <div>
      <strong>{{ item.data.escalatedBy }}</strong>
      <span class="badge bg-danger text-white ms-2">
        {{ item.data.user?.role || 'Admin' }}
      </span>
    </div>

    <small class="text-muted">
      {{ new Date(item.time).toLocaleString() }}
    </small>
  </div>

  <!-- Escalation Reason -->
  <p class="mb-2">
    {{ item.data.escalationReason }}
  </p>

  <div class="small text-muted mb-3">
    <div>
      <strong>Escalated To Team:</strong>
      {{ item.data.escalatedToTeam }}
    </div>

    <div>
      <strong>Escalated To:</strong>
      {{ item.data.assignedTo?.name || '_' }}
    </div>
  </div>

  <!-- 🔥 ESCALATION RESPONSES -->
  <div v-if="ticket?.escalationResponses?.length" class="mt-3 border-top pt-3">

    <div
      v-for="response in ticket.escalationResponses"
      :key="response.responseID"
      class="border rounded p-3 bg-white mb-2"
    >
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
        <div>
          <strong>{{ response.responder?.name || 'Support' }}</strong>
          <span class="badge bg-primary text-white ms-2">
            {{ response.responder?.role || 'Agent' }}
          </span>
        </div>

        <small class="text-muted">
          {{ new Date(response.createdAt).toLocaleString() }}
        </small>
      </div>

      <p class="mb-0">
        {{ response.message }}
      </p>
    </div>

  </div>
</div>

            </div>
          </div>
          
        </div>
      </div>
    </template>

    <div v-else class="card shadow-sm">
      <div class="card-body text-danger">
        Ticket not found.
      </div>
    </div>
  </div>

      <!-- Assign Ticket modal -->
      <div
        class="modal fade"
        id="assignTicketModal"
        tabindex="-1"
        aria-labelledby="assignTicket"
        aria-hidden="true"
      >
        <div class="modal-dialog modal-dialog-centered">
          <AssignTicketForm
            v-if="selectedTicket"
            :ticket="selectedTicket"
            :mode="actionMode"
            @ticket-assigned="handleTicketAssigning"
          />       
        </div>
      </div>

</template>