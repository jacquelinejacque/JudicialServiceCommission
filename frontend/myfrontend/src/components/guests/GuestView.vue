<script>
import { Const } from '@/utils/constants'
import Toastify from 'toastify-js'
import CheckOut from './CheckOut.vue'
import ApproveGuest from './ApproveGuest.vue'
import PreRegisterForm from './PreRegisterForm.vue'

export default {
  components: {
    PreRegisterForm,
    ApproveGuest,
    CheckOut,
  },
  data() {
    return {
      loading: false,
      guest: null, 
       currentUser: JSON.parse(localStorage.getItem('user') || '{}')
    }
  },

  computed: {
    visitID() {
      return this.$route.params.visitID
    }, 
    roleName() {
        return (
        this.currentUser?.role?.roleName ||
        this.currentUser?.roleName ||
        ''
        ).toLowerCase()
    },

    isAdmin() {
        return this.roleName === 'admin'
    },

    isReceptionist() {
        return this.roleName === 'receptionist'
    },

    canCheckOutGuest() {
        return (
        this.guest?.status === 'checkedIn' &&
        (this.isAdmin || this.isReceptionist)
        )
    },
  },

  mounted() {
    this.loadGuest()
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

    async loadGuest() {
        try {
            this.loading = true

            const response = await fetch(
            `${Const.BASE_URL}/guestsVisits/findByID`,
            {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                'access-token': localStorage.getItem('accessToken')
                },
                body: JSON.stringify({
                visitID: this.visitID
                })
            }
            )

            const result = await response.json()

            if (result.status !== 200) {
            throw new Error(result.message || 'Failed to load guest')
            }

            this.guest = result.guestVisit
        } catch (error) {
            console.error(error)
            this.showToast(error.message, true)
        } finally {
            this.loading = false
        }
    },

    formatDate(date) {
      if (!date) return '_'

      return new Date(date).toLocaleString()
    }
  }
}
</script>

<template>
  <div class="container-xxl py-3">

<div class="card-header bg-white d-flex align-items-center justify-content-between gap-3 py-3">
  <div class="d-flex align-items-center gap-3">
    <button
      class="btn btn-outline-secondary btn-sm"
      @click="$router.back()"
    >
      <i class="bi bi-arrow-left"></i>
    </button>

    <div>
      <h4 class="mb-1">Guest Visit Details</h4>
      <small class="text-muted">
        Detailed information about the guest visit.
      </small>
    </div>
  </div>

  <button
    v-if="canCheckOutGuest"
    class="btn btn-danger btn-sm"
    @click="openCheckOutModal"
  >
    Check Out Guest
  </button>
</div>

    <div v-if="loading" class="card shadow-sm">
      <div class="card-body text-muted">
        Loading guest details...
      </div>
    </div>

    <template v-else-if="guest">

      <!-- Guest Information -->
      <div class="card shadow-sm mb-4">
        <div class="card-header">
          <h5 class="mb-0">
            {{ guest.guestName }}
          </h5>
        </div>

        <div class="card-body">
          <div class="row g-3">

            <div class="col-md-6">
              <div class="border rounded p-3 h-100">

                <h6 class="mb-3">Personal Information</h6>

                <p><strong>Name:</strong> {{ guest.guestName || '_' }}</p>
                <p><strong>Phone:</strong> {{ guest.phone || '_' }}</p>
                <p><strong>Email:</strong> {{ guest.email || '_' }}</p>
                <p><strong>ID Type:</strong> {{ guest.idType || '_' }}</p>
                <p><strong>ID Number:</strong> {{ guest.idNumber || '_' }}</p>
                <p><strong>Organization:</strong> {{ guest.organization || '_' }}</p>

              </div>
            </div>

            <div class="col-md-6">
              <div class="border rounded p-3 h-100">

                <h6 class="mb-3">Visit Information</h6>

                <p><strong>Pass Number:</strong> {{ guest.passNumber || '_' }}</p>
                <p><strong>Visit Category:</strong> {{ guest.visitCategory || '_' }}</p>
                <p><strong>Department:</strong> {{ guest.department || '_' }}</p>
                <p><strong>Status:</strong> {{ guest.status || '_' }}</p>
                <p><strong>Purpose:</strong></p>

                <div class="alert alert-light border">
                  {{ guest.purpose || '_' }}
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Visit Timeline -->
      <div class="card shadow-sm mb-4">
        <div class="card-header">
          <h5 class="mb-0">Visit Timeline</h5>
        </div>

        <div class="card-body">

          <div class="row g-3">

            <div class="col-md-6">
              <div class="border rounded p-3">

                <p><strong>Expected Arrival:</strong></p>
                <p>{{ formatDate(guest.expectedArrival) }}</p>

                <p><strong>Expected Departure:</strong></p>
                <p>{{ formatDate(guest.expectedDeparture) }}</p>

                <p><strong>Expiry Time:</strong></p>
                <p>{{ formatDate(guest.expiryTime) }}</p>

              </div>
            </div>

            <div class="col-md-6">
              <div class="border rounded p-3">

                <p><strong>Check In Time:</strong></p>
                <p>{{ formatDate(guest.checkInTime) }}</p>

                <p><strong>Check Out Time:</strong></p>
                <p>{{ formatDate(guest.checkOutTime) }}</p>

                <p><strong>Visit Duration:</strong></p>
                <p>{{ guest.timeIn || '_' }} Minutes</p>

              </div>
            </div>

          </div>

        </div>
      </div>

      <!-- Badge Information -->
      <div class="card shadow-sm mb-4">
        <div class="card-header">
          <h5 class="mb-0">Badge Information</h5>
        </div>

        <div class="card-body">

          <div class="row">

            <div class="col-md-6">
              <p><strong>Badge Number:</strong> {{ guest.badgeNumber || '_' }}</p>
              <p><strong>Badge Returned:</strong>
                {{ guest.badgeReturned ? 'Yes' : 'No' }}
              </p>
            </div>

            <div class="col-md-6">
              <p><strong>Host Notified:</strong>
                {{ guest.hostNotified ? 'Yes' : 'No' }}
              </p>

              <p><strong>Approval Required:</strong>
                {{ guest.approvalRequired ? 'Yes' : 'No' }}
              </p>
            </div>

          </div>

        </div>
      </div>

      <!-- Remarks -->
      <div class="card shadow-sm">
        <div class="card-header">
          <h5 class="mb-0">Remarks</h5>
        </div>

        <div class="card-body">
          <div class="alert alert-light border">
            {{ guest.remarks || 'No remarks available.' }}
          </div>
        </div>
      </div>

    </template>

    <div v-else class="card shadow-sm">
      <div class="card-body text-danger">
        Guest record not found.
      </div>
    </div>

    <div class="modal modal-blur fade" id="approveGuestModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <ApproveGuest
          v-if="selectedApprovalVisitID"
          :visitID="selectedApprovalVisitID"
          @approval-completed="handleApprovalCompleted"
        />
      </div>
    </div>

    <div class="modal modal-blur fade" id="checkOutModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <CheckOut
          v-if="selectedCheckOutVisitID"
          :visitID="selectedCheckOutVisitID"
          @checkout-completed="handleCheckOutCompleted"
        />
      </div>
    </div>

     <!-- CheckIn Pre Registered Guest modal -->
    <div class="modal modal-blur fade" id="checkInModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <PreRegisterForm
          mode="checkInPreRegistered"
          :prefillData="selectedGuest"
          @guest-saved="handleGuestSaved"
        />
      </div>
    </div>
  </div>
</template>