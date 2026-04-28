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
        
      },
      loading: false,
      receptionDesks: [],
      loadingReceptionDesks: false       
        
    }
  },
    mounted() {
        this.fetchReceptionDesk();
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
      const requiredFields = [
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

      for (const field of requiredFields) {
        if (!this.formData[field]) {
          this.showToast(`${field.replace(/([A-Z])/g, ' $1')} is required.`, true)
          return false
        }
      }

      if (
        new Date(this.formData.expectedDeparture) <=
        new Date(this.formData.expectedArrival)
      ) {
        this.showToast('Expected departure must be after expected arrival.', true)
        return false
      }

      return true
    },

    async handleSubmit() {
      try {
        if (!this.validateForm()) return

        this.loading = true

        const payload = {
        guestName: this.formData.guestName,
        phone: this.formData.phone,
        email: this.formData.email || null,
        idType: this.formData.idType,
        idNumber: this.formData.idNumber,
        organization: this.formData.organization || null,
        purpose: this.formData.purpose,
        department: this.formData.department || 'Administration',
        visitCategory: this.formData.visitCategory || 'personalVisit',
        expectedArrival: this.formData.expectedArrival
            ? new Date(this.formData.expectedArrival).toISOString()
            : null,
        expectedDeparture: this.formData.expectedDeparture
            ? new Date(this.formData.expectedDeparture).toISOString()
            : null,
        receptionDeskID: this.formData.receptionDeskID,
       
        }

        const res = await axios.post(
          `${Const.BASE_URL}/guestsVisits/preRegister`,
          payload,
          {
            headers: {
              'access-token': localStorage.getItem('accessToken'),
              'Content-Type': 'application/json'
            }
          }
        )

        const message = res.data?.message || 'Guest pre-registered successfully'

        if (res.data?.status === 200 || res.data?.status === 201) {
          this.showToast(message, false)
          this.resetForm()
          this.$emit('guest-pre-registered')
        } else {
          this.showToast(message, true)
        }
      } catch (error) {
        console.error('Error:', error.response?.data || error.message)

        const message =
          error.response?.data?.message ||
          error.message ||
          'Failed to pre-register guest'

        this.showToast(message, true)
      } finally {
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
    }
  }
}
</script>

<template>
  <div>
    <form @submit.prevent="handleSubmit">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Pre-register Guest</h5>
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

            <div class="col-md-6 mb-3">
              <label class="form-label">Email</label>
              <input
                type="email"
                class="form-control"
                v-model="formData.email"
              />
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

            <div class="col-md-6 mb-3">
              <label class="form-label">Organization</label>
              <input
                type="text"
                class="form-control"
                v-model="formData.organization"
              />
            </div>

            <div class="col-md-6 mb-3">
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

            <div class="col-md-6 mb-3">
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

            <div class="col-md-6 mb-3">
              <label class="form-label">Expected Arrival</label>
              <input
                type="datetime-local"
                class="form-control"
                v-model="formData.expectedArrival"
              />
            </div>

            <div class="col-md-6 mb-3">
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

            <div class="col-md-6 mb-3">
              <label class="form-label">Purpose</label>
              <textarea
                class="form-control"
                rows="3"
                v-model="formData.purpose"
              ></textarea>
            </div>

          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn me-auto" data-bs-dismiss="modal">
            Close
          </button>

          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading">Submitting...</span>
            <span v-else>Pre-register Guest</span>
          </button>
        </div>
      </div>
    </form>
  </div>
</template>