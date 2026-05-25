<script>
import { Const } from '@/utils/constants'
import axios from 'axios'
import Toastify from 'toastify-js'

export default {
  data() {
    return {
        formData: {
            guestName: '',
            phone: '',
            email: '',
            idType: '',
            idNumber: '',
            organization: '',
            purpose: '',
            department: '',
            visitCategory: '',
            expectedArrival: '',
            expectedDeparture: '',
            receptionDeskID: '',
            hostUserID: '',
            hostUsers: [],
            loadingHostUsers: false,
        },
        loading: false,
        receptionDesks: [],
        loadingReceptionDesks: false       
        
    }
  },
    mounted() {
      this.fetchReceptionDesk();
      if (this.isWalkIn) {
        this.fetchHostUsers()
      }
      if (this.prefillData) {
        this.formData = { ...this.formData, ...this.prefillData }
      }
    },
    computed: {
      isWalkIn() {
          return this.mode === 'walkIn'
      },
      isCheckInPreRegistered() {
        return this.mode === 'checkInPreRegistered'
      },

      modalTitle() {
        if (this.isWalkIn) return 'Add Walk-In Guest'
        if (this.isCheckInPreRegistered) return 'Check-In Guest'
        return 'Pre-register Guest'
      },

      submitText() {
        if (this.isWalkIn) return 'Save Walk-In Guest'
        if (this.isCheckInPreRegistered) return 'Check-In Guest'
        return 'Pre-register Guest'
      }
    },
    props: {
        mode: {
            type: String,
            default: 'preRegister'
        },
        prefillData: { type: Object, default: null }
    },
    watch: {
      prefillData: {
        immediate: true,
        deep: true,
        handler(value) {
          if (value) {
            this.formData = {
              ...this.formData,
              ...value,
              timeIn: value.timeIn || 60,
              remarks: ''
            }
          }
        }
      }
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

    validateForm() {
      let requiredFields = []

      if (this.isWalkIn) {
        requiredFields = [
          'guestName',
          'phone',
          'idType',
          'idNumber',
          'purpose',
          'department',
          'receptionDeskID',
          'hostUserID'
        ]
      } else if (this.isCheckInPreRegistered) {
        requiredFields = [
          'guestName',
          'phone',
          'idType',
          'idNumber',
          'receptionDeskID',
          'timeIn'
        ]
      } else {
        requiredFields = [
          'guestName',
          'phone',
          'idType',
          'idNumber',
          'purpose',
          'department',
          'visitCategory',
          'expectedArrival',
          'expectedDeparture',
          'receptionDeskID'
        ]
      }

      for (const field of requiredFields) {
        if (!this.formData[field]) {
          this.showToast(`${field.replace(/([A-Z])/g, ' $1')} is required.`, true)
          return false
        }
      }

      if (
        !this.isWalkIn &&
        !this.isCheckInPreRegistered &&
        new Date(this.formData.expectedDeparture) <= new Date(this.formData.expectedArrival)
      ) {
        this.showToast('Expected departure must be after expected arrival.', true)
        return false
      }

      if (
        this.isCheckInPreRegistered &&
        (isNaN(this.formData.timeIn) || parseInt(this.formData.timeIn) <= 0)
      ) {
        this.showToast('Visit duration must be a valid positive number of minutes.', true)
        return false
      }

      return true
    },

    async handleSubmit() {
      try {
        if (!this.validateForm()) return

        this.loading = true

        let url = ''

        if (this.isWalkIn || this.isCheckInPreRegistered) {
          url = `${Const.BASE_URL}/guestsVisits/checkIn`
        } else {
          url = `${Const.BASE_URL}/guestsVisits/preRegister`
        }

        let payload = {}

        if (this.isWalkIn) {
          payload = {
            guestName: this.formData.guestName,
            phone: this.formData.phone,
            email: this.formData.email || null,
            idType: this.formData.idType,
            idNumber: this.formData.idNumber,
            organization: this.formData.organization || null,
            purpose: this.formData.purpose,
            department: this.formData.department,
            receptionDeskID: this.formData.receptionDeskID,
            hostUserID: this.formData.hostUserID,
          }
        }
        else if (this.isCheckInPreRegistered) {
          payload = {
            visitID: this.formData.visitID,
            guestName: this.formData.guestName,
            phone: this.formData.phone,
            email: this.formData.email || null,
            idType: this.formData.idType,
            idNumber: this.formData.idNumber,
            organization: this.formData.organization || null,
            purpose: this.formData.purpose,
            department: this.formData.department,
            receptionDeskID: this.formData.receptionDeskID,
            timeIn: this.formData.timeIn || 60,
            remarks: this.formData.remarks || ''
          }
        }
        else {
          payload = {
            guestName: this.formData.guestName,
            phone: this.formData.phone,
            email: this.formData.email || null,
            idType: this.formData.idType,
            idNumber: this.formData.idNumber,
            organization: this.formData.organization || null,
            purpose: this.formData.purpose,
            department: this.formData.department || 'Administration',
            visitCategory: this.formData.visitCategory || 'personalVisit',
            expectedArrival: new Date(this.formData.expectedArrival).toISOString(),
            expectedDeparture: new Date(this.formData.expectedDeparture).toISOString(),
            receptionDeskID: this.formData.receptionDeskID
          }
        }
        const res = await axios.post(url, payload, {
        headers: {
            'access-token': localStorage.getItem('accessToken'),
            'Content-Type': 'application/json'
        }
        })

        const message = res.data?.message || 'Guest pre-registered successfully'

        if (res.data?.status === 200 || res.data?.status === 201) {
          this.showToast(message, false)
          this.resetForm()
          this.$emit('guest-saved', this.mode)
        } else {
          this.showToast(res.data?.error || res.data?.message || 'Request failed', true)
        }
        } catch (error) {
          console.error('FULL API ERROR:', error.response?.data || error.message)

          const apiError = error.response?.data

          const message =
            apiError?.error ||
            apiError?.message ||
            error.message ||
            'Failed to pre-register guest'

          this.showToast(message, true)
        }finally {
        this.loading = false
      }
    },

    resetForm() {
      this.formData = {
        guestName: '',
        phone: '',
        email: '',
        idType: '',
        idNumber: '',
        organization: '',
        purpose: '',
        department: '',
        visitCategory: '',
        expectedArrival: '',
        expectedDeparture: '',
        receptionDeskID: '',
       
      }
    },

    async fetchReceptionDesk() {
    try {
        this.loadingReceptionDesks = true

        const res = await axios.get(`${Const.BASE_URL}/receptionistDesks/list`, {
        headers: {
            'access-token': localStorage.getItem('accessToken')
        }
        })

        if (res.data?.status === 200) {
        this.receptionDesks = res.data.data || []
        } else {
        this.receptionDesks = []
        this.showToast(res.data?.message || 'Failed to load Reception Desks', true)
        }
    } catch (err) {
        console.error(err)
        this.showToast(
        err?.response?.data?.message || 'Failed to fetch reception desks',
        true
        )
        this.receptionDesks = []
    } finally {
        this.loadingReceptionDesks = false
    }
    }, 

    async fetchHostUsers() {
      try {
        this.loadingHostUsers = true

        const res = await axios.get(`${Const.BASE_URL}/users/list`, {
          params: {
            role: 'normalUser',
            team: 'JSC'
          },
          headers: {
            'access-token': localStorage.getItem('accessToken')
          }
        })

        if (res.data?.status === 200) {
          this.hostUsers = (res.data.data || []).filter(user => user.status === 'active')
        } else {
          this.hostUsers = []
          this.showToast(res.data?.message || 'Failed to load host users', true)
        }
      } catch (err) {
        console.error(err)
        this.hostUsers = []
        this.showToast(err?.response?.data?.message || 'Failed to fetch host users', true)
      } finally {
        this.loadingHostUsers = false
      }
    }
  },

}
</script>

<template>
  <div>
    <form @submit.prevent="handleSubmit">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ modalTitle }}</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>

        <div class="modal-body">
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label">Guest Name</label>
              <input
                type="text"
                class="form-control"
                v-model="formData.guestName"
              />
            </div>

            <div class="col-md-6 mb-3">
              <label class="form-label">Phone</label>
              <input
                type="text"
                class="form-control"
                v-model="formData.phone"
              />
            </div>

            <div class="col-md-6 mb-3" v-if="!isCheckInPreRegistered">
              <label class="form-label">Email</label>
              <input type="email" class="form-control" v-model="formData.email" />
            </div>

            <div class="col-md-6 mb-3">
              <label class="form-label">ID Type</label>
              <select class="form-control" v-model="formData.idType">
                <option value="">Select ID Type</option>
                <option value="nationalID">National ID</option>
                <option value="passport">Passport</option>
                <option value="workID">Work ID</option>
              </select>
            </div>

            <div class="col-md-6 mb-3">
              <label class="form-label">ID Number</label>
              <input
                type="text"
                class="form-control"
                v-model="formData.idNumber"
              />
            </div>

            <div class="col-md-6 mb-3" v-if="!isCheckInPreRegistered">
              <label class="form-label">Organization</label>
              <input type="text" class="form-control" v-model="formData.organization" />
            </div>

            <div class="col-md-6 mb-3" v-if="!isCheckInPreRegistered">
              <label class="form-label">Department</label>
                <select class="form-control" v-model="formData.department">
                <option value="">Select Department</option>
                <option value="administration">Administration</option>
                <option value="officeOfRegistrar">Office of Registrar</option>
                <option value="legal">Legal </option>
                <option value="Complaints">Complaints </option>
                <option value="communication">Communication</option>
                <option value="HR">HR</option>
                <option value="accounts">Accounts</option>
                <option value="finance">Finance</option>
                <option value="procurement">Procurement</option>
                <option value="supplyChain">Supply Chain</option>
                <option value="inspectorate">Inspectorate</option>
                <option value="ICT">ICT</option>
                <option value="records">Records</option>
                </select>
            </div> 

            <div class="col-md-6 mb-3" v-if="!isWalkIn && !isCheckInPreRegistered">
              <label class="form-label">Visit Category</label>
                <select class="form-control" v-model="formData.visitCategory">
                <option value="">Select Category</option>
                <option value="officialMeeting">Official Meeting</option>
                <option value="vendor">Vendor</option>
                <option value="contractor">Contractor</option>
                <option value="interview">Interview</option>
                <option value="delivery">Delivery</option>
                <option value="walkIn">Walk In</option>
                <option value="personalVisit">Personal Visit</option>
                </select>
            </div>

            <div class="col-md-6 mb-3" v-if="!isCheckInPreRegistered && !isWalkIn">
              <label class="form-label">Expected Arrival</label>
              <input
                type="datetime-local"
                class="form-control"
                v-model="formData.expectedArrival"
              />
            </div>

            <div class="col-md-6 mb-3" v-if="!isCheckInPreRegistered && !isWalkIn">
              <label class="form-label">Expected Departure</label>
              <input
                type="datetime-local"
                class="form-control"
                v-model="formData.expectedDeparture"
              />
            </div>

            <div class="col-md-6 mb-3">
            <label class="form-label">Reception Desk</label>

            <select v-model="formData.receptionDeskID" class="form-select">
                <option value="" disabled>Select Reception Desk</option>

                <option
                v-for="receptionDesk in receptionDesks"
                :key="receptionDesk.receptionDeskID"
                :value="receptionDesk.receptionDeskID"
                >
                {{ receptionDesk.deskName }}
                </option>
            </select>
            </div>

            <div class="col-md-6 mb-3" v-if="!isCheckInPreRegistered">
              <label class="form-label">Purpose</label>
              <textarea
                class="form-control"
                rows="3"
                v-model="formData.purpose"
              ></textarea>
            </div>

            <div class="col-md-6 mb-3" v-if="isCheckInPreRegistered">
              <label class="form-label">Visit Duration (minutes)</label>
              <input type="number" class="form-control" v-model="formData.timeIn" />
            </div>
            <div class="col-md-6 mb-3" v-if="isWalkIn">
              <label class="form-label">Host User</label>
              <select
                class="form-select"
                v-model="formData.hostUserID"
                :disabled="loadingHostUsers"
              >
                <option value="">
                  {{ loadingHostUsers ? 'Loading host users...' : 'Select Host User' }}
                </option>

                <option
                  v-for="user in hostUsers"
                  :key="user.userID"
                  :value="user.userID"
                >
                  {{ user.name }}
                </option>
              </select>
            </div>

          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn me-auto" data-bs-dismiss="modal">
            Close
          </button>

          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading">Submitting...</span>
            <span v-else>{{ submitText }}</span>
          </button>
        </div>
      </div>
    </form>
  </div>
</template>