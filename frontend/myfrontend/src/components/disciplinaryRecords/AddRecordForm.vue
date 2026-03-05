<script>
import { Const } from '@/utils/constants'
import axios from 'axios'
import Toastify from 'toastify-js'
//import { Toast } from 'bootstrap/dist/js/bootstrap.bundle'
import { formatPhoneNumber } from '@/utils/helpers'

export default {
  data() {
    return {
      formData: {
        officerName: '',
        designation: '',
        dateFiled: '',
        natureOfCharges: '',
        panel: '',
        decision: '',
      },
      loading: false,
      formSubmitted: false,
      toastElement: null
    }
  },
  computed: {
  formattedPhoneNumber: {
    get() {
      return formatPhoneNumber(this.formData.phone);
    },
    set(value) {
      this.formData.phone = value;
    }
  }
},

  watch: {
  'formData.phone': function (newVal) {
    if (newVal) {
      this.formData.phone = formatPhoneNumber(newVal);
    }
  }
},


  methods: {
    showToast(message, isDanger) {
      Toastify({
        text: message,
        style: {
          background: isDanger ? '#d63939' : '#2fb344'
        }
      }).showToast()
    },
    async handleSubmit() {
      try {
        if (!this.formData.officerName || !this.formData.designation || !this.formData.dateFiled || !this.formData.natureOfCharges || !this.formData.panel || !this.formData.decision ) {
        this.showToast('Please fill all required fields.', true)
        return
        }

        this.loading = true
        const submitData = {
            officerName: this.formData.officerName,
            designation: this.formData.designation,
            dateFiled: this.formData.dateFiled,
            natureOfCharges: this.formData.natureOfCharges,
            panel: this.formData.panel,
            decision: this.formData.decision
        }

        console.log('Submitting data:', submitData)

        const res = await axios.post(`${Const.BASE_URL}/disciplinaryRecords/create`, submitData, {
          headers: { 'access-token': localStorage.getItem('accessToken') }
        })
        console.log(res.data)
        if (res.data?.status === 200) {
          this.showToast('Record successfully created', false)
          this.$emit('record-Added');
        } else {
          const message = res.data.message || 'Failed to create record'
          this.showToast(message, true)
        }
      } catch (error) {
        console.error('Error:', error.response?.data || error.message)
        const message = error.response?.data?.message || 'Failed to create record, please try again'
        this.showToast(message, true)
      } finally {
        this.loading = false
      }
    },


    resetForm() {
      this.formData = {
        officerName: '',
        designation: '',
        dateFiled: '',
        natureOfCharges: '',
        panel: '',
        decision: '',
      }

      this.formSubmitted = true
    }
  }
}
</script>

<template>
  <div>
  
    <form @submit.prevent="handleSubmit">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">New Record</h5>
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
              <label for="name" class="form-label">Officer Name</label>
              <input type="text" class="form-control" id="officerName" v-model="formData.officerName"  />
            </div>
            <div class="col-md-6 mb-3">
              <label for="designation" class="form-label">Designation</label>
              <input
                type="text"
                class="form-control"
                id="designation"
                v-model="formData.designation"                
              />
            </div>
            <div class="col-md-6 mb-3">
              <label for="dateFiled" class="form-label">Date Filed</label>
              <input
                type="date"
                class="form-control"
                id="dateFiled"
                v-model="formData.dateFiled"                
              />
            </div>
            <div class="col-md-6 mb-3">
              <label for="decision" class="form-label">Decision</label>
              <input
                type="text"
                class="form-control"
                id="decision"
                v-model="formData.decision"                
              />
            </div>            
            <div class="col-md-6 mb-3">
            <label for="natureOfCharges" class="form-label">Nature Of Charges</label>
            <input type="text" class="form-control" id="natureOfCharges" v-model="formData.natureOfCharges"  />
            </div>

            <div class="col-md-6 mb-3">
            <label class="form-label text-weight-1000">Select Panel</label>
                <select v-model="formData.panel" class="form-control">
                <option value="">Select Panel</option>
                <option value="panel1">Panel 1</option>
                <option value="panel2">Panel 2</option>
                </select>
           
            </div>

          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn me-auto" data-bs-dismiss="modal">Close</button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading">Submitting...</span>
            <span v-if="!loading">Submit</span>
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<style>
.form {
  display: flex;
  flex-direction: column;
}
</style>
